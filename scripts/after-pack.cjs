// Sets the Windows executable icon and version info without Wine (pure JS via resedit).
const path = require('node:path');
const fs = require('node:fs');
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const { NtExecutable, NtExecutableResource, Resource, Data } = ResEdit.default ?? ResEdit;
  const productName = context.packager.appInfo.productName;
  const version = context.packager.appInfo.version;
  const exePath = path.join(context.appOutDir, `${productName}.exe`);
  const exe = NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = NtExecutableResource.from(exe);
  const iconFile = Data.IconFile.from(fs.readFileSync(path.join(context.packager.info.projectDir, 'build', 'icon.ico')));
  const groups = Resource.IconGroupEntry.fromEntries(res.entries);
  const iconGroupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, iconGroupId, lang, iconFile.icons.map((i) => i.data));
  const viList = Resource.VersionInfo.fromEntries(res.entries);
  const vi = viList.length ? viList[0] : Resource.VersionInfo.createEmpty();
  const [maj, min, pat] = version.split('.').map((n) => parseInt(n, 10) || 0);
  vi.setFileVersion(maj, min, pat, 0, 1033);
  vi.setProductVersion(maj, min, pat, 0, 1033);
  const langs = vi.getAllLanguagesForStringValues();
  const target = langs.length ? langs[0] : { lang: 1033, codepage: 1200 };
  vi.setStringValues(target, {
    ProductName: productName,
    FileDescription: productName,
    CompanyName: productName,
    LegalCopyright: productName,
    OriginalFilename: `${productName}.exe`,
    InternalName: productName,
    FileVersion: version,
    ProductVersion: version,
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • afterPack: set icon + version info on ${productName}.exe`);
};

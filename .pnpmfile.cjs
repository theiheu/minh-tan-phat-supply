
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.dependencies && pkg.dependencies.postcss) {
        pkg.dependencies.postcss = '^8.5.18';
      }
      if (pkg.dependencies && pkg.dependencies.jsondiffpatch) {
        pkg.dependencies.jsondiffpatch = '^0.7.6';
      }
      return pkg;
    }
  }
};


const fs = require("fs");
const path = require("path");

module.exports = (request, options) => {
  try {
    return options.defaultResolver(request, options);
  } catch (error) {
    const searchPaths = [options.basedir, process.cwd(), path.join(process.cwd(), "node_modules")];

    try {
      return require.resolve(request, { paths: searchPaths });
    } catch {
      if (request.startsWith(".") || request.startsWith("/")) {
        const absolute = request.startsWith(".") ? path.resolve(options.basedir, request) : request;
        const candidates = [`${absolute}.ts`, `${absolute}.tsx`, path.join(absolute, "index.ts"), path.join(absolute, "index.tsx")];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) return candidate;
        }
      }

      if (request === "@the-eye/shared") {
        return path.resolve(__dirname, "../../packages/shared/src/index.ts");
      }

      throw error;
    }
  }
};

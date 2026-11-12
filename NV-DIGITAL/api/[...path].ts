// Vercel receives a pre-bundled CommonJS API so it does not type-check the
// entire Replit/Express source tree with Vercel's NodeNext settings.
declare const require: (modulePath: string) => any;

const bundle = require("../artifacts/api-server/dist-vercel/app.cjs");
// esbuild exposes an ESM default export as { default: app } in CommonJS.
const app = bundle.default ?? bundle;

if (typeof app !== "function") {
  throw new Error("A API compilada não exporta uma função Express.");
}

export default app;

import { resolve } from "path";

export default {
  "**/*.(ts|tsx|js)": (filenames) => [
    `pnpm prettier --write ${filenames.map((file) => resolve(file)).join(" ")}`,
    `pnpm lint . ${filenames.join(" ")}`,
  ],
  "*.go": ["gofmt -w"],
};

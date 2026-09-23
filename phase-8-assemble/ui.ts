import { readFileSync } from "fs";
import { join } from "path";
import { DESK_MUST_INCLUDE, SLIDES, UI_SURFACES } from "./slides";

export function readUiContract(projectRoot = process.cwd()) {
  const desk = readFileSync(join(projectRoot, UI_SURFACES.desk), "utf8");
  const home = readFileSync(join(projectRoot, UI_SURFACES.home), "utf8");
  const slides = readFileSync(join(projectRoot, UI_SURFACES.slides), "utf8");
  return { desk, home, slides };
}

export function missingUiSurfaces(projectRoot = process.cwd()): string[] {
  const files = readUiContract(projectRoot);
  const errors: string[] = [];
  if (!files.home.includes("Prototype")) errors.push("Home page must render the counsellor Prototype.");
  for (const token of DESK_MUST_INCLUDE) {
    if (!files.desk.includes(token)) errors.push(`Counsellor desk is missing “${token}”.`);
  }
  if (SLIDES.length !== 5) errors.push("Phase 8 must ship exactly 5 slides.");
  for (const slide of SLIDES) {
    if (!files.slides.includes(slide.kicker)) {
      errors.push(`Presentation is missing slide ${slide.kicker}.`);
    }
  }
  if (files.desk.includes("/presentation") || files.desk.includes("5 slides")) {
    errors.push("The counsellor desk must not attach the presentation.");
  }
  if (!files.slides.includes("01 · Input")) {
    errors.push("Slides stay on /presentation only.");
  }
  return errors;
}

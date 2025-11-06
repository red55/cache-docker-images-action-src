import { saveDockerImages } from "./docker";
import { info } from "@actions/core";
info("Saving Docker images...");
await saveDockerImages();
info("Docker images saved.");

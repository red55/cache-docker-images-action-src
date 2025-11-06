import { loadDockerImages } from "./docker";
import { info } from "@actions/core";
info("Loading Docker images...");
await loadDockerImages();
info("Docker images loaded.");

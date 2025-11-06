import { getInput, getState, info, saveState, setOutput } from "@actions/core";
import { restoreCache, saveCache } from "@actions/cache";
import Dockerode from "dockerode";

const CACHE_HIT = "cache-hit";
const DOCKER_IMAGES_LIST = "docker-images-list";
const DOCKER_IMAGES_PATH = "~/.docker-images.tar";

export async function loadDockerImages() : Promise<void> {
    const docker = new Dockerode();
    const requestedKey = getInput("key", { required: true });
    const restoredKey = await restoreCache([DOCKER_IMAGES_PATH], requestedKey);
    const cacheHit = requestedKey === restoredKey;

    setOutput(CACHE_HIT, cacheHit);
    saveState(CACHE_HIT, cacheHit);

    if (cacheHit) {
        info(`Cache hit for key: ${restoredKey}`);
        docker.loadImage(DOCKER_IMAGES_PATH);
    }

    const images = await docker.listImages();
    saveState(DOCKER_IMAGES_LIST, JSON.stringify(images));
}

export async function saveDockerImages() : Promise<void> {
    const docker = new Dockerode();
    const cacheHit = getState(CACHE_HIT) === "true";
    const readOnly = getInput("read-only") === "true";
    const key = getInput("key", { required: true });

    if (cacheHit) {
        info(`Cache hit occurred for key: ${key}, skipping save.`);
    } else if (readOnly) {
        info(`Cache miss and read-only mode is enabled for key: ${key}, skipping save.`);
    } else if (key === await restoreCache([""], key, [], { lookupOnly: true })) {
        info(`Cache already exists for key: ${key}, skipping save.`);
    } else {
        const previousImages = JSON.parse(getState(DOCKER_IMAGES_LIST)) as Dockerode.ImageInfo[];
        const currentImages = await docker.listImages();
        const newImages = currentImages.filter(currentImage => {
            return !previousImages.some(previousImage => previousImage.Id === currentImage.Id);
        });

        if (newImages.length === 0) {
            info(`No new Docker images to save for key: ${key}.`);
            return;
        }
    }
}

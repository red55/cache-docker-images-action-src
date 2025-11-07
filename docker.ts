import { getInput, getState, info, error, notice, saveState, setOutput, setFailed } from "@actions/core";
import { restoreCache, saveCache } from "@actions/cache";
import Dockerode from "dockerode";
import { execBashCommand } from "./cmd-line";

const CACHE_HIT = "cache-hit";
const DOCKER_IMAGES_LIST = "docker-images-list";
const DOCKER_IMAGES_PATH = `${process.env.HOME}/.docker-images.tar`;

export async function loadDockerImages() : Promise<void> {
    const docker = new Dockerode();
    const requestedKey = getInput("key", { required: true });
    const restoredKey = await restoreCache([DOCKER_IMAGES_PATH], requestedKey);
    const cacheHit = requestedKey === restoredKey;

    notice(`loadDockerImages: cacheHit=${cacheHit}`);
    setOutput(CACHE_HIT, cacheHit);
    saveState(CACHE_HIT, cacheHit);

    if (cacheHit) {
        info(`Cache hit for key: ${restoredKey}, loading Docker images from cache.`);
        await execBashCommand(`docker load -i ${DOCKER_IMAGES_PATH}`);
    } else {
        info(`Cache miss for key: ${requestedKey}`);
        const images = await docker.listImages();
        notice(`Found ${images.length} Docker images.`);
        saveState(DOCKER_IMAGES_LIST, images);
    }
}

export async function saveDockerImages() : Promise<void> {
    const docker = new Dockerode();
    const cacheHit = getState(CACHE_HIT) === "true";
    const readOnly = getInput("read-only") === "true";
    const key = getInput("key", { required: true });

    notice(`saveDockerImages: cacheHit=${cacheHit}, readOnly=${readOnly}, key=${key}`);
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
            notice(`No new Docker images to save for key: ${key}.`);
            return;
        }
        try {
            const imagesToSave = newImages.map(image => image.RepoTags ? image.RepoTags[0] : image.Id);
            await execBashCommand(`docker save -o ${DOCKER_IMAGES_PATH} ${imagesToSave.join(" ")}`);

            await saveCache([DOCKER_IMAGES_PATH], key);
        } catch (err) {
            setFailed(`Failed to save Docker images to cache: ${err}`);
        }
    }
}

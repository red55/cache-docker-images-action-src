import { test, expect, mock, afterAll } from "bun:test";
import type { DownloadOptions,UploadOptions } from "@actions/cache/lib/options";
import fs from "fs";
const DOCKER_IMAGES_PATH = `${process.env.HOME}/.docker-images.tar`;

const DEFAULT_TIMEOUT = 2 * 60 * 1000;
const TEST_IMAGE = "hello-world:latest";

mock.module('@actions/cache', () => ({
    restoreCache: mock(async (paths: string[],
        primaryKey: string,
        restoreKeys?: string[],
        options?: DownloadOptions,
        enableCrossOsArchive?: boolean) : Promise<string | undefined> => {
            if (fs.existsSync(DOCKER_IMAGES_PATH)) {
                console.log(`Mock: restoreCache hit for key=${primaryKey}`);
                return primaryKey;
            }
            console.log(`Mock: restoreCache miss for key=${primaryKey}`);
            return undefined;
        }),
    saveCache: mock(async (paths: string[], key: string,
        options?: UploadOptions,
        enableCrossOsArchive?: boolean): Promise<number> => {
            console.log(`Mock: saveCache called with key=${key}`);
            return 12345;
    })
}));

mock.module('@actions/core', () => ({
    getInput: mock((name: string, options?: any): string => {
        if (name === "key") {
            return "test-cache-key";
        }
        if (name === "read-only") {
            return "false";
        }
        return "";
    }),
    setOutput: mock((name: string, value: any): void => {
        console.log(`Mock: setOutput called with name=${name}, value=${value}`);
    }),
    getState: mock((name: string): string => {
        fs.mkdirSync(`./out`, { recursive: true });
        try {
            return fs.readFileSync(`./out/${name}`, 'utf-8');
        } catch (e) {
            console.error(`Error reading mock state file: ${e}`);
            return "";
        }
    }),
    saveState: mock((name: string, value: any): void => {
        try {
            fs.mkdirSync(`./out`, { recursive: true });
            fs.writeFileSync(`./out/${name}`,
                (typeof value === "string") ? value : JSON.stringify(value), 'utf-8');
        } catch (e) {
            console.error(`Error writing mock state file: ${e}`);
        }
    }),
    info: mock((message: string): void => {
        console.log(`::info ::${message}`);
    }),
    error: mock((message: string | Error): void => {
        console.error(`::error ::${message}`);
    }),
    notice: mock((message: string): void => {
        console.log(`::notice ::${message}`);
    }),
}));

import * as dockerModule from "./docker";

test("Loading docker images first time and saving current image list", async () => {
    await dockerModule.loadDockerImages();
}, { timeout: DEFAULT_TIMEOUT });
test(`Pulling test image ${TEST_IMAGE}`, async () => {
    const { execBashCommand } = await import("./cmd-line");
    await execBashCommand(`docker pull ${TEST_IMAGE}`);
}, { timeout: DEFAULT_TIMEOUT });
test("Post action", async () => {
    await dockerModule.saveDockerImages();
}, { timeout: DEFAULT_TIMEOUT });
test(`Remove test image ${TEST_IMAGE}`, async () => {
    const { execBashCommand } = await import("./cmd-line");;
    await execBashCommand(`docker rmi ${TEST_IMAGE}`);
});
test("Loading docker images again", async () => {
    await dockerModule.loadDockerImages();
}, { timeout: DEFAULT_TIMEOUT });
test("test image is present", async () => {
    const { execBashCommand } = await import("./cmd-line");
    const output = await execBashCommand(`docker images -q ${TEST_IMAGE}`);
    expect(output.trim().length).toBeGreaterThan(0);
}, { timeout: DEFAULT_TIMEOUT });

afterAll(async () => {
    const { execBashCommand } = await import("./cmd-line");
    await execBashCommand(`docker rmi ${TEST_IMAGE}`);
});

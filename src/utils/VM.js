/**
 * Utils to work w/ Multipass
 */
import { get } from "svelte/store";
import { settingsStore } from "./store/Settings";
import { isEmptyDir } from "../utils/Utils";
import _ from "lodash";
import { getMountPath } from "../utils/Mount";
import run from "./RunCommand";

const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const rimraf = require("rimraf");
const sudo = require("sudo-prompt");

export function hasRemoteEngine() {
    return true;
    return _.get(get(settingsStore), "remoteEngine", false);
}

//Mounts user selected path to the VM
export async function mountPath(localPath, projectName) {
    return new Promise((resolve, reject) => {
        if (os.platform() === "win32") {
            getWinVmPath(localPath, projectName).then(
                (res) => {
                    resolve(res);
                },
                (err) => {
                    reject(err);
                }
            );
        } else {
            let basePath = path.basename(localPath);
            console.log(
                `🚀 LOG | file: VM.js | line 35 | returnnewPromise | basePath`,
                basePath
            );
            let vmPath = getMountPath(localPath);
            let mountCmd = `multipass exec deck-app -- stat ${vmPath}`;
            console.log(
                `🚀 LOG | file: VM.js | line 40 | returnnewPromise | vmPath`,
                vmPath
            );
            exec(mountCmd, (error, stdout, stderr) => {
                const err = {
                    error: "multipassMountError",
                    context: error,
                };
                //Added error object for showing Full Disk Access modal
                if (error) reject(err);
                console.log(
                    `🚀 LOG | file: VM.js | line 46 | exec | stderr`,
                    stderr
                );
                if (stderr) reject(err);
                resolve(vmPath);
            });
        }
    });
}

export function getWinVmPath(localPath, projectName) {
    return new Promise(async function (resolve, reject) {
        isEmptyDir(localPath).then(
            async (response) => {
                if (response === true) {
                    // Empty folder logic
                    createSymlink(localPath, projectName).then(
                        (res) => {
                            console.log(`🚀 LOG | file: VM.js | line 86 | res`, res)
                            exec(`wsl -d deck-app mkdir -p ${res.path}`, (error, stdout, stderr) => {
                                console.log(`🚀 LOG | file: VM.js | line 88 | exec | error`, error)
                                console.log(`🚀 LOG | file: VM.js | line 88 | exec | stderr`, stderr)
                                console.log(`🚀 LOG | file: VM.js | line 88 | exec | stdout`, stdout)
                            });
                            resolve(_.get(res, "path", false));
                        },
                        (err) => {
                            reject(err);
                        }
                    );
                } else {
                    fixFolderLocation(localPath, projectName).then(
                        (res) => {
                            console.log(`🚀 LOG | file: VM.js | line 86 | res`, res)
                            resolve(_.get(res, "path", false));
                        },
                        (err) => {
                            reject(err);
                        }
                    );
                    // reject('The selected project path is not empty, select an empty path');
                    // let path1 = getLocalDriveToWslMntPath(localPath);
                    // let path2 =
                    //     "/" + ["home", "deck-projects", projectName].join("/");
                    // let runCmd =
                    //     "wsl -d deck-app ln -s '" + path1 + "' '" + path2 + "'";
                    // exec(runCmd, (error, stdout, stderr) => {
                    //     if (error) reject(error);
                    //     if (stderr) reject(stderr);
                    //     resolve(path2);
                    // });
                }
            },
            (err) => {
                reject(err);
            }
        );
    });
}

/**
 *
 * @description : Get local path array to MNT path
 * @param {*} localPath
 * @returns {String} mnt path
 */
export function getLocalDriveToWslMntPath(localPath) {
    let trimLocalPath = "",
        localPathArray = [];
    trimLocalPath = _.replace(localPath, ":", "");
    localPathArray = trimLocalPath.split("\\");
    if (_.get(localPathArray, "[0]", "")) {
        localPathArray[0] = _.toLower(localPathArray[0]);
    }
    return "/mnt/" + localPathArray.join("/");
}

/**
 *
 * @description : Create a link of given path
 * @param {String} localPath
 * @param {String} projectName
 * @returns {Promise} envPath
 */
function createSymlink(localPathRaw, projectName) {
    return new Promise(async function (resolve, reject) {
        let options = {
            name: "DECK"
        };
        let localPath = localPathRaw
        if (localPath.startsWith('\\\\wsl.localhost\\')) {
            localPath = `\\\\wsl$\\${localPath.substring('\\\\wsl.localhost\\'.length)}`
        }
        // let returnData = "/" + ["home", "deck-projects", projectName].join("/");
        const newPath = `\\\\wsl$\\deck-app\\home\\deck-projects\\${projectName}`
        const returnData = newPath

        if (localPath.startsWith('\\\\wsl$\\') && localPath !== newPath) {
            console.log(`🚀 LOG | file: VM.js | line 144 | nothing to do for now`, localPath, newPath)

            resolve({
                message: "Nothig done. Keeping as it is",
                path: returnData,
                status: 100
            });
        }
        else {
            console.log(`🚀 LOG | file: VM.js | line 168 | creating shortcut`, localPath, newPath)
            let command =
                `mklink /D "${localPath}" "${newPath}"`;

            // Get status of folder delete
            let deleteFolderStatus = await deleteFolder(localPath);

            if (deleteFolderStatus === true) {
                sudo.exec(
                    command,
                    options,
                    function (error, stdout, stderr) {
                        if (error) {
                            reject({
                                message: "Something is wrong, mklink failed.",
                                data: error
                            });
                        } else {
                            resolve({
                                message: "Link successfully created.",
                                path: returnData,
                                status: 100
                            });
                        }
                    }
                );
            } else {
                reject({
                    message: "Something is wrong. Folder delete failed",
                    data: deleteFolderStatus,
                });
            }
        }
    });
}

function fixFolderLocation(localPathRaw, projectName) {
    return new Promise(async function (resolve, reject) {
        let options = {
            name: "DECK"
        };
        let localPath = localPathRaw
        if (localPath.startsWith('\\\\wsl.localhost\\')) {
            localPath = `\\\\wsl$\\${localPath.substring('\\\\wsl.localhost\\'.length)}`
        }

        const newPath = `\\\\wsl$\\deck-app\\home\\deck-projects\\${projectName}`
        let returnData = newPath

        if (localPath.startsWith('\\\\wsl$\\') && localPath !== newPath) {
            console.log(`🚀 LOG | file: VM.js | line 218 | moving project`, localPath, newPath)

            let regex = /(?:\\\\wsl\$\\)([^\\]*)(.*)/g
            var match = regex.exec(localPath);
            const fromDistro = match[1]
            const fromPath = match[2].replaceAll('\\', '/')

            regex = /(?:\\\\wsl\$\\)([^\\]*)(.*)/g
            match = regex.exec(newPath);
            const toDistro = match[1]
            const toPath = match[2].replaceAll('\\', '/')

            let command = `wsl -d ${fromDistro} -- rm -rf "/mnt/wsl/deck-temp-${projectName}" \`&\`& mv "${fromPath}/" "/mnt/wsl/deck-temp-${projectName}"`

            run(command, undefined, false).then((ptyProcess) => {
                ptyProcess.on("exit", async (code) => {
                    if (code === 0) {
                        let command = `wsl -d ${toDistro} -- rm -rf "${toPath}" \`&\`& mv "/mnt/wsl/deck-temp-${projectName}/" "${toPath}"`

                        console.log(command)
                        run(command, undefined, false).then((ptyProcess) => {
                            ptyProcess.on("exit", async (code) => {
                                if (code === 0) {
                                    resolve({
                                        message: "Folder successfully moved.",
                                        path: returnData,
                                        status: 100
                                    });
                                } else {
                                    reject({
                                        message: "Something is wrong, move failed.",
                                        data: error
                                    });
                                }
                            });
                        },
                            (error) => {
                                reject({
                                    message: "Something is wrong, move failed.",
                                    data: error
                                });
                            })
                    } else {
                        reject({
                            message: "Something is wrong, move failed.",
                            data: error
                        });
                    }
                });
            },
                (error) => {
                    reject({
                        message: "Something is wrong, move failed.",
                        data: error
                    });
                })
        }
        else {
            console.log(`🚀 LOG | file: VM.js | line 242 | nothing to do for now`, localPath, newPath)

            resolve({
                message: "Nothig done. Keeping as it is",
                path: localPath,
                status: 100
            });
        }
    });
}

/**
 *
 * @description : Delete the given path folder
 * @param {String} localPath
 * @returns {Boolean}
 */
function deleteFolder(localPath) {
    return new Promise(function (resolve, reject) {
        rimraf(
            localPath,
            function () {
                resolve(true);
            },
            function (err) {
                reject(err);
            }
        );
    });
}

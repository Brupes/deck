const os = require("os");
const shell = process.env[os.platform() === "win32" ? "COMSPEC" : "SHELL"];
const {  ipcRenderer } = require("electron");
import { nodePtySpawn } from "./Utils"

/**
 * TODO:
 * Fix issue with Store not updating value correctly
 */

export function getPtyProcess() {
    return nodePtySpawn(shell, [], {
        name: "xterm-color",
        cols: 120,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env,
        // handleFlowControl: true,
    });
}

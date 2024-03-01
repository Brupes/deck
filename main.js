const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require("electron");
const { Tray, nativeImage } = require("electron");
const logger = require('electron-log/main');
// const { autoUpdater } = require("electron-updater");
const serve = require("electron-serve");
const loadURL = serve({ directory: "public" });
const _ = require("lodash");
const isPortReachable = require("is-port-reachable");
const path = require("path");
const domain = ".stacks.run";
const wsl = require("./resources/wsl");
const os = require("os");
const pty = require("node-pty");

const { powerSaveBlocker } = require("electron");

const config = require('electron-json-config').factory(`${app.getPath("home")}/.deck/settings.json`);

let tray = null;
let mainWindow;
let forceQuit = false;
let proxy;

require('@electron/remote/main').initialize()
logger.initialize();

function isDev() {
    return !app.isPackaged;
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1280,
        minHeight: 720,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInSubFrames: true,
            // preload: path.join(__dirname, 'preload.js'),
            devTools: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'public/favicon.png'),
        show: false,
    });

    require("@electron/remote/main").enable(mainWindow.webContents)

    // This block of code is intended for development purpose only.
    // Delete this entire block of code when you are ready to package the application.
    if (isDev()) {
        mainWindow.loadURL('http://localhost:8080/');
    } else {
        loadURL(mainWindow);
    }

    // Uncomment the following line of code when app is ready to be packaged.
    // loadURL(mainWindow);

    if (isDev()) {
        // Open the DevTools and also disable Electron Security Warning.
        process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true;
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on("close", function (event) {
        logger.log("App id quiting: ", forceQuit);
        if (!forceQuit) {
            logger.log("Preventing force quit");
            event.preventDefault();
            mainWindow.hide();
            return false;
        } else {
            app.quit();
        }
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        // autoUpdater.checkForUpdatesAndNotify();
    });

    global.nodePty = pty

    // mainWindow.once('focus', () => {
    //     logger.log('mainWindow focused');
    // });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(function () {
    // Add icons and context menus to the system's notification area.
    initTray();
    createWindow();
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    logger.log("All windows closed");
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        // Unregister all shortcuts.
        globalShortcut.unregisterAll()
        app.quit();
    }
});

app.on("activate", () => {
    logger.log("Activating window...");
    mainWindow.show();
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    // if (mainWindow === null) createWindow()
});

app.on("before-quit", function () {
    logger.log("Force quit true");
    forceQuit = true;
});

app.on("will-finish-launching", function () {
    // Protocol handler for osx
    app.on("open-url", function (event, url) {
        event.preventDefault();
        let deeplinkingUrl = url;
        logEverywhere("open-url# " + deeplinkingUrl);
    });
});

//Auto updater events
// autoUpdater.on('checking-for-update', () => {
//     sentUpdatesToRenderer('Checking for update...');
// })
// autoUpdater.on('update-available', (info) => {
//     sentUpdatesToRenderer('Update available.');
// })
// autoUpdater.on('update-not-available', (info) => {
//     sentUpdatesToRenderer('Update not available.');
// })
// autoUpdater.on('error', (err) => {
//     sentUpdatesToRenderer('Error in auto-updater. ' + err);
// })
// autoUpdater.on('download-progress', (progressObj) => {
//     let log_message = "Download speed: " + progressObj.bytesPerSecond;
//     log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
//     log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
//     sentUpdatesToRenderer(log_message);
// })
// autoUpdater.on('update-downloaded', (info) => {
//     sentUpdatesToRenderer('Update downloaded');
// });

function sentUpdatesToRenderer(message, event = 'auto-updater') {
    mainWindow.webContents.send(event, message);
}

// Log both at dev console and at running node console instance
function logEverywhere(s) {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(`console.log("${s}")`);
    }
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on("open-file-dialog", (event) => {
    dialog
        .showOpenDialog({
            // defaultPath: "\\\\wsl$\\deck-app\\mnt\\wsl",
            properties: ["openDirectory", "createDirectory"],
            // message:
            //     "The selected path is where your codes are, use an existing project path or a new one",
        })
        .then((result) => {
            event.sender.send("selected-directory", result.filePaths);
        })
        .catch((err) => { });
});

ipcMain.on("app_version", (event) => {
    event.sender.send("app_version", { version: app.getVersion() });
});

ipcMain.on("restart-app", (event) => {
    app.relaunch();
    app.exit();
});

ipcMain.handle("power-saving", async (event, arg) => {
    logger.log("Power save blocker", arg);
    let powerSaving = false;
    if (_.get(arg, "action", "") === "start") {
        logger.log("Power save blocker going to start.");
        powerSaving = powerSaveBlocker.start("prevent-display-sleep");
        logger.log("Power save blocker going to start result.", powerSaving);
    } else if (_.get(arg, "action", "") === "stop") {
        logger.log("Power save blocker going to stop.");
        powerSaving = _.get(arg, "powerSaving", false);
        if (powerSaveBlocker.isStarted(powerSaving)) {
            logger.log("Power save blocker going to stop result.", powerSaving);
            powerSaveBlocker.stop(powerSaving);
        }
    }
    return powerSaving;
});

ipcMain.on("register-proxy", async (event, data) => {
    let dockerEngine = await config.get("settings.dockerEngine");
    logger.log("Receiving proxy args from renderer");
    logger.log(data); // prints "ping"
    logger.log(`http://${dockerEngine.host}:`);
    if (_.has(data, "action") && data.action == "init") {
        let http = await isPortReachable(80, { host: "localhost" });
        let https = await isPortReachable(443, { host: "localhost" });

        if (http === false && https === false) {
            initialize(data.args.path);
            register(data.args.stacks);
            logger.log("Registering proxies");
        } else {
            logger.log("ERR: port 80 & 443 are blocked");
        }
    } else if (_.has(data, "action") && data.action == "register") {
        let host = _.has(dockerEngine, "host")
            ? dockerEngine.host
            : "localhost";
        proxy.register(
            data.args.stack + domain,
            `http://${host}:${data.args.port}`
        );
    } else if (_.has(data, "action") && data.action == "unregister") {
        let host = _.has(dockerEngine, "host")
            ? dockerEngine.host
            : "localhost";
        proxy.unregister(
            data.args.stack + domain
        );
    } else {
        logger.log("Unknown message from parent: ", data);
    }
    logger.log(dockerEngine);
});

ipcMain.on("start-wsl", (event) => {
    runWsl();
});

ipcMain.on("dock-bounce", (event, data) => {
    if (os.platform() === 'darwin')
        app.dock.bounce(data.type);
    else if (os.platform() === 'win32') {
        //https://www.electronjs.org/docs/latest/tutorial/windows-taskbar#flash-frame
        logger.log('Flashing windows frame ...');
        mainWindow.flashFrame(true);
        //If it's not a critical alert in Windows
        //then hide it after 10s
        if (data.type !== 'critical') {
            setTimeout(() => {
                mainWindow.flashFrame(false);
            }, 10000);
        }
    }
});

ipcMain.handle('getSettingValue', (event, ...args) => {
    return config.get(...args);
});

ipcMain.handle('setSettingValue', (event, ...args) => {
    return config.set(...args);
});

function initialize(path) {
    logger.log("Received path ", path);
    proxy = require("redbird")({
        port: 80,
        ssl: {
            port: 443,
            key: `${path}/storage/certs/dev-key.pem`,
            cert: `${path}/storage/certs/dev-cert.pem`,
        },
        bunyan: (isDev()) ? true : false
    });
}

function register(data) {
    logger.log("Received data ", data);
    let dockerEngine = config.get("settings.dockerEngine");
    let host = _.has(dockerEngine, "host") ? dockerEngine.host : "localhost";
    _.forOwn(data, function (value, key) {
        if (value.STACK_HTTP_PORT) {
            proxy.register(
                `${value.COMPOSE_PROJECT_NAME}.stacks.run`,
                `http://${host}:${value.STACK_HTTP_PORT}`
            );
        }
    });
}

/**
 * WSL run on windows system
 */
async function runWsl() {
    let dockerEngine = await config.get("settings.dockerEngine");

    if (dockerEngine.remoteEngine && os.platform() === "win32") {
        wsl.runWSLDaemon("wsl -d deck-app dockerd");
    }
}

/**
 * Add icons and context menus to the system's notification area.
 */
function initTray() {
    tray = new Tray(
        nativeImage.createFromPath(
            path.join(__dirname, "./assets/tray-icon/IconTemplate.png")
        )
    );
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Open DECK",
            click: function () {
                mainWindow.show();
            },
        },
        {
            label: "Quit",
            click: function () {
                forceQuit = true;
                app.quit();
            },
        },
    ]);
    tray.on('click', () => {
        mainWindow.show();
    });
    tray.setToolTip("Open DECK");
    tray.setContextMenu(contextMenu);
}

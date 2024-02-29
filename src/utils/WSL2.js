const { PowerShell } = require('node-powershell');
const os = require('os');

export async function iSWSL2Installed() {
    if (os.platform() !== 'win32') return null;
    const status = await getWSL2Status();
    const regex = /(?:[^:\n\r]*:\s)([^\n\n\r]*)/g

    var matches = [];
    var match;
    while (match = regex.exec(status)) {
        matches.push(match[1]);
    }
    
    const wsl2 = matches.length === 2 && matches[1] === '2'
    const deck = matches.length === 2 && matches[0] === 'deck-app'

    return {
        wsl2,
        deck
    };
}


async function getWSL2Status() {
    //Bug https://stackoverflow.com/questions/66127118/why-cannot-i-match-for-strings-from-wsl-exe-output
    //Same is also posted on official WSL repo in Github
    const out = await PowerShell.$`$status = (wsl --status); $status -Replace "\`0", ""`;

    if (out.hadErrors === false)
        return out.raw

    return false;
}

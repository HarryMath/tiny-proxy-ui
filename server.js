const http = require(`http`);
const fileReader = require(`fs`);
const port = 3000;

const template = {
    path: 'pac.template.js',
    encoding: 'utf8',
}
const PROXY = `"PROXY 3.18.73.169:8888"`;
const matchFunction = `shExpMatch`;
const proxyDomains = [
    `nordvpn`,
    `atlassian`,
    `jira`,
    `your-cv`
];

let pacFile = ``;


const readFile = async (path, encoding) => {
    return new Promise((resolve, reject) => {
        fileReader.readFile(path, { encoding }, (err, data) => {
            if (err) {
                console.error(`failed to read template file`);
                reject(err);
            } else {
                resolve(data.toString());
            }
        });
    })
}

const createTemplate = async () => {
    const temolateFile = await readFile(template.path, template.encoding);
    const condition = proxyDomains
        .map(d => `${matchFunction}(host,"*${d}*")`)
        .join(`||`)

    pacFile = temolateFile
        .replace(`'{{condition}}'`, condition)
        .replace(`'{{proxy}}'`, PROXY);
}

createTemplate().then(() => {
    const server = http.createServer((req, res) => {
        console.log(`requesting .pac file from ip ${req.socket.remoteAddress}`);
        res.statusCode = 200;
        res.setHeader(`Content-Type`, `text/plain`);
        res.end(pacFile);
    });
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
});
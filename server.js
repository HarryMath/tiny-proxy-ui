const http = require(`http`);
const fileReader = require(`fs`);
const { execSync } = require("child_process");
const port = 80;

const filterFile = {
    path: '../../etc/tinyproxy/filter',
    encoding: 'utf8',
}

const pacTemplate = {
    path: 'pac.template.js',
    encoding: 'utf8',
}

const viewTemplate = {
    path: 'view.html',
    encoding: 'utf8',
}

const domainsFile = {
    path: 'domains.txt',
    encoding: 'utf8',
}

const PASSWORD = "H&J%QJK!SJA!9@&@!ASQ"
const PROXY = `"PROXY 3.18.73.169:8888"`;
const matchFunction = `shExpMatch`;
let proxyDomains = [
    `nordvpn`,
    `atlassian`,
    `jira`,
    `alfresco`,
];

let pacFile = ``;

const readFile = async (path, encoding) => {
    return new Promise((resolve, reject) => {
        fileReader.readFile(path, { encoding }, (err, data) => {
            if (err) {
                console.error(`failed to read "${path}" file`);
                reject(err);
            } else {
                resolve(data.toString());
            }
        });
    });
}

const writeFile = async (path, data) => {
    return new Promise((resolve, reject) => {
        fileReader.writeFile(path, data, (err, data) => {
            if (err) {
                console.error(`failed to save "${path}" file`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

const setUpProxyDomains = async () => {
    const templateFile = await readFile(pacTemplate.path, pacTemplate.encoding);
    const domainsTxt = await readFile(domainsFile.path, domainsFile.encoding);
    proxyDomains = domainsTxt.split(',').map(d => d.trim()).filter(d => d.length > 0);

    const condition = proxyDomains
        .map(d => `${matchFunction}(host,"*${d}*")`)
        .join(`||`)

    pacFile = templateFile
        .replace(`'{{condition}}'`, condition)
        .replace(`'{{proxy}}'`, PROXY);
}

const readBody = async (req) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
        req.on('error', reject);
    });
}

setUpProxyDomains().then(() => {
    const server = http.createServer(async (req, res) => {
        try {
            const urlParts = req.url.split('/');
            const url = urlParts.length > 0 ? urlParts[1] : '';

            if (url.includes('view')) {
                const password = url.split('view?pwd=')[1];
                if (password !== PASSWORD) {
                    res.statusCode = 403;
                    res.end('Invalid password');
                    return;
                }
                let view = await readFile(viewTemplate.path, viewTemplate.encoding);
                view = view.replace(`{{proxy-domains}}`, proxyDomains.join(','))
                res.statusCode = 200;
                res.end(view);
                return;
            }

            if (url === 'update' && req.method === 'POST') {
                const body = JSON.parse(await readBody(req));
                if (Array.isArray(body)) {
                    try {
                        await writeFile(domainsFile.path, body.join(','));
                        await writeFile(filterFile.path, body.join('\n'));
                        await setUpProxyDomains();
                        execSync(`sudo systemctl restart tinyproxy`);
                        res.statusCode = 200;
                        res.end();
                        return;
                    } catch (ignore) {
                        console.warn("error saving data: ", ignore);
                        res.statusCode = 500;
                    }
                } else {
                    res.statusCode = 400;
                }
                res.end();
                return;
            }

            console.log(`Requesting .pac file from ip ${req.socket.remoteAddress}.\nName is '${url}'\n`);
            res.statusCode = 200;
            res.setHeader(`Content-Type`, `text/plain`);
            res.end(pacFile);

        } catch (e) {
            console.warn('error processing request: ');
            console.error(e);
        }
    });
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
});

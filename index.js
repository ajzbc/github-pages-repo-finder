(async () => {

    document.getElementById('inputForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        var logs = document.getElementById("logs");
        logs.className = "container";
        logs.innerHTML = '<p class="title">Log</p>'

        var result = document.getElementById("result");
        result.innerHTML = "";
        result.className = "";


        var urlInput = document.getElementById("url").value;

        urlInput = urlInput.trim();

        log(`Input = ${urlInput}`);

        var regexp = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i;
        if (!regexp.test(urlInput)) {
            log(`Invalid URL`, true);
            throw new Error('Invalid URL');
        }

        var parser = document.createElement('a');
        parser.href = urlInput;

        log(`Hostname = ${parser.hostname}`);

        var path = parser.pathname
        path = path.split("/");
        path.shift();

        if (path[0] == "") {
            log(`No addiational path`)
        } else {
            log(`Path = ${path[0]}`);
        }

        var host = await dns(parser.hostname);

        var parsed = psl.parse(parser.hostname);

        if (parsed.domain != parser.hotname) {
            log(`Without subdomains = ${parsed.domain}`);
        }

        var www = ""

        if (parser.hostname != "www." + parsed.domain) {
            www = await dns("www." + parsed.domain);
        }

        log(`Searching for CNAME record @ ${parser.hostname}`);
        if (host.Answer) {
            if (host.Answer[0].data.endsWith(".github.io.")) {
                log(`Found CNAME record = ${host.Answer[0].data}`);
                findRepo(host.Answer[0].data, parsed.domain, path[0]);
            } else {
                ///////TODO
            }
        } else if (!parser.hostname.startsWith("www") && www.Answer) {
            log(`Searching for CNAME record @ ${"www."+parsed.domain}`)
            if (www.Answer[0].data.endsWith(".github.io.")) {
                log(`Found CNAME record = ${www.Answer[0].data}`);
                findRepo(www.Answer[0].data, parsed.domain, path[0]);
            } else {
                ///////TODO
            }
        } else {
            log(`Failed to find CNAME record pointing to GitHub`, true);
            addFail("Most likely due to DNS proxy or it is not a GitHub Pages site");
        }

    });

    async function dns(url) {
        var response = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${url}&type=CNAME`, {
                headers: {
                    Accept: 'application/dns-json'
                }
            })
        var response = await response.json();
        return response;
    }

    async function findRepo(dnsData, domain, path) {
        var strip = dnsData.replace('.github.io.', '');
        log(`Determined GitHub username = ${strip}`);

        var repos = await getRepos(strip);

        log(`Loaded ${repos.length} repositories`);

        main: for (const repo of repos) {
            if (repo.name == strip + ".github.io") {
                log(`Confirmed ${repo.name} exist`);
                var base = await containsCNAME(strip, `${strip}.github.io`, "master");
                if (base == true) {
                    log(`${repo.name} contains a CNAME file`);
                    var baseCNAME = await getCNAME(strip, `${strip}.github.io`, "master");
                    baseCNAME = baseCNAME.trim();
                    if (baseCNAME == domain) {
                        log(`CNAME file is equal to target domain (${domain})`);
                        if (path != "") {
                            log(`Searching for repository with name equal to path name (${path})`);
                            for (const repo2 of repos) {
                                if (repo2.has_pages == true && repo2.name == path) {
                                    log(`Found repository "${repo2.name}"`); //Reminder may be in another branch
                                    addRepo(true, `https://github.com/${strip}/${repo2.name}`, "Reminder: Live code may be located in another branch");
                                    break main;
                                }
                            }
                            log(`Most likely repository "${repo.name}"`);
                            addRepo(false, `https://github.com/${strip}/${repo.name}`, "Possibly a private repository");
                            break main;
                        } else {
                            log(`Found repository "${repo.name}"`);
                            addRepo(true, `https://github.com/${strip}/${repo.name}`);
                            break main;
                        }
                    } else {
                        ///DUPLICATED///
                        log(`Searching for repository with CNAME file`);
                        for (const repo2 of repos) {
                            if (repo2.has_pages == true) {
                                var branches = await getBranches(strip, repo2.name)
                                for (const branch of branches) {
                                    if (branch.name == "master" || branch.name == "gh-pages") {
                                        log(`Searching ${repo2.name}/${branch.name} for CNAME record`);
                                        var statusCNAME = await containsCNAME(strip, repo2.name, branch.name);
                                        if (statusCNAME == true) {
                                            var cname = await getCNAME(strip, repo2.name, branch.name)
                                            cname = cname.trim();
                                            if (cname == domain) {
                                                log(`Found repository ${repo2.name}/${branch.name}`);
                                                if (branch.name == "master") {
                                                    addRepo(true, `https://github.com/${strip}/${repo2.name}`);
                                                    break main;
                                                } else if (branch.name = "gh-paghes") {
                                                    addRepo(true, `https://github.com/${strip}/${repo2.name}/tree/gh-pages`);
                                                    break main;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    ///DUPLICATED///
                    log(`Searching for repository with CNAME file`);
                    for (const repo2 of repos) {
                        if (repo2.has_pages == true) {
                            var branches = await getBranches(strip, repo2.name)
                            for (const branch of branches) {
                                if (branch.name == "master" || branch.name == "gh-pages") {
                                    log(`Searching ${repo2.name}/${branch.name} for CNAME record`);
                                    var statusCNAME = await containsCNAME(strip, repo2.name, branch.name);
                                    if (statusCNAME == true) {
                                        var cname = await getCNAME(strip, repo2.name, branch.name)
                                        cname = cname.trim();
                                        if (cname == domain) {
                                            log(`Found repository ${repo2.name}/${branch.name}`);
                                            if (branch.name == "master") {
                                                addRepo(true, `https://github.com/${strip}/${repo2.name}`);
                                                break main;
                                            } else if (branch.name = "gh-paghes") {
                                                addRepo(true, `https://github.com/${strip}/${repo2.name}/tree/gh-pages`);
                                                break main;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

            } else {
                log(`Unable to find Repository`, true);
                addFail(`Repository most likely private`, strip);
            }
        }
    }

    async function getRepos(id) {
        var type = "users"
        var response = await fetch(`https://api.github.com/${type}/${id}/repos`);
        if (response.status == 404) {
            type = "orgs";
            var response = await fetch(`https://api.github.com/${type}/${id}/repos`);
        }
        response = await response.json();
        return response;
    }

    async function getBranches(owner, repo) {
        var response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`);
        var response = await response.json();
        return response;
    }

    async function getCNAME(owner, repo, branch) {
        var response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/CNAME`);
        response = await response.text();
        return response;
    }

    async function containsCNAME(owner, repo, branch) {
        var response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`);
        var response = await response.json();

        var status = false;

        for (const thing of response) {
            if (thing.name == "CNAME" && thing.type == "file") {
                status = true
            }
        }

        return status;
    }

    function addFail(reason, user) {
        var result = document.getElementById("result");
        result.innerHTML = "";
        result.className = "container";

        var subD = document.createElement("p");
        subD.className = "sub";
        subD.textContent = "Unable to find repository";

        var reasonD = document.createElement("p");
        reasonD.className = "reason";
        reasonD.textContent = reason;

        result.appendChild(subD);
        result.appendChild(reasonD);

        if (user) {
            var subD2 = document.createElement("p");
            subD2.className = "user";
            subD2.textContent = "Determined user:";

            result.appendChild(subD2);

            var userD = document.createElement("a");
            userD.href = user;
            userD.textContent = user;

            result.appendChild(userD);
        }

    }

    function addRepo(certain, repoLink, extra) {
        var result = document.getElementById("result");
        result.innerHTML = "";
        result.className = "container";

        var subD = document.createElement("p");
        subD.className = "sub";
        if (certain == true) {
            subD.textContent = "Repository";
        } else {
            subD.textContent = "Most Likely";
        }

        var repo = document.createElement("a");
        repo.href = repoLink;
        repo.textContent = repoLink;

        result.appendChild(subD);
        result.appendChild(repo);

        if (extra) {
            var subD2 = document.createElement("p");
            subD2.className = "extra";
            subD2.textContent = extra;
            result.appendChild(subD2);
        }
    }

    function log(message, status) {
        var logs = document.getElementById("logs");
        if (status) {
            logs.innerHTML += `<p class="end">${message}</p>`;
        } else {
            logs.innerHTML += `<p>${message}</p>`;
        }
    }

})();
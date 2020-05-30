require('dotenv').config();
const http = require('https');
const Discord = require('discord.js');
const CronJob = require('cron').CronJob;

const TOKEN = process.env.TOKEN;
const HARDWARE_RG = /(180[0-9]sysgame06)/;
const REGION = "europe";

const bot = new Discord.Client();
var job;

const COMMANDS = {
    "sstop": () => {
        job.stop();
        sendMessage("Surveillance de So You Start arrêtée");
    },
    "sstart": () => {
        job.start();
        sendMessage("Surveillance de So You Start relancée");
    },
    "scheck": () => {
        if (job.running) {
            sendMessage("Etat : RUNNING");
        } else {
            sendMessage("Etat : STOPPED");
        }
    },
    "sclear": () => {
        getChannel().messages.fetch({limit: 99}).then(fetched => {
            getChannel().bulkDelete(fetched.filter(msg => msg.author.username === "SoYouBot")).then();
        });
    }
};

/**
 * Get the list of availabilities
 *
 * @returns {Promise<JSON>}
 */
function getAvailabilityJson() {
    return new Promise((resolve, reject) => {
        const API_URL = 'https://www.ovh.com/engine/api/dedicated/server/availabilities?country=fr';
        http.get(API_URL, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                let body = "";
                res.on('data', e => body += e);
                res.on('end', e => resolve(JSON.parse(body)));
            } else {
                console.error(res.statusCode + " => " + res.statusMessage);
            }
        });
    });
}

/**
 * Define if it has available servers
 *
 * @param response Response from availabilities
 * @returns {boolean}
 */
function hasAvailableServers(response) {
    const servers = response
        .reduce((acc, g) => [...acc, ...g.datacenters.map(datacenter => {
            return {
                ...datacenter,
                hardware: g.hardware,
                region: g.region
            };
        })], [])
        .filter(srv => srv.availability !== "unavailable" && srv.region === REGION && HARDWARE_RG.test(srv.hardware));
    return servers.length > 0;
}

/**
 * Notify discord channel from a new server available
 */
function notifNewServer() {
    const aurel = bot.users.find(user => user.username === 'aurel85');
    const epi = bot.users.find(user => user.username === 'EpiCanard');
    sendMessage(`${aurel} & ${epi} AAAHHHH Il y a de nouveaux serveurs disponiblent sur SoYouStart !\nSoYouStart:  https://www.soyoustart.com/fr/serveurs-game/`);
}

function getChannel() {
    return bot.channels.cache.find(channel => channel.name === 'so-you-ping-aurel');
}

function sendMessage(msg) {
    console.info(`Sending message : ${msg}`);
    getChannel().send(msg);
}

async function deleteLastCommand(message) {
    const last = await message.channel.messages.fetch({limit: 1});
    message.channel.bulkDelete(last);
}

/**
 * Configure that launch every minutes
 */
function configureCron() {
    job = new CronJob('0 */1 * * * *', function() {
        getAvailabilityJson().then(response => {
            if(hasAvailableServers(response)) {
                console.info(`Nouveaux serveurs accessibles !!`);
                notifNewServer();
            } else {
                console.info(`Aucun serveur accessibles !!`);
            }
        });
    });
    job.start();
}

bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);
    configureCron();
});

bot.on('message', (message) => {
    if (Object.keys(COMMANDS).includes(message.content)) {
        deleteLastCommand(message).then(COMMANDS[message.content]());
    }
});

bot.login(TOKEN);

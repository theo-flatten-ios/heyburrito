import { App, LogLevel } from '@slack/bolt';
import config from './config';
import BurritoStore from './store/BurritoStore';
import LocalStore from './store/LocalStore';
import { parseMessage } from './lib/parseMessage';
import { validBotMention, validMessage } from './lib/validator';
import WBCHandler from './slack/Wbc';
import * as log from 'bog';

const {
    enableDecrement,
    dailyCap,
    dailyDecCap,
    emojiInc,
    emojiDec,
    disableEmojiDec,
} = config.slack;

console.log('Bolt App Token (xoxb-): ', config.slack.token);
console.log('Bolt App Token (xapp-): ', config.slack.appToken);
const app = new App({
    token: config.slack.token,
    signingSecret: config.slack.signingSecret,
    socketMode: true,
    appToken: config.slack.appToken,
    logLevel: LogLevel.DEBUG,
});

interface Emojis {
    type: string;
    emoji: string;
}

interface Updates {
    username: string;
    type: string;
}
const emojis: Array<Emojis> = [];

const incEmojis = emojiInc.split(',').map((emoji => emoji.trim()));
incEmojis.forEach((emoji: string) => emojis.push({ type: 'inc', emoji }));

if (!disableEmojiDec) {
    const decEmojis = emojiDec.split(',').map((emoji => emoji.trim()));
    decEmojis.forEach((emoji: string) => emojis.push({ type: 'dec', emoji }));
}

const giveBurritos = async (giver: string, updates: Updates[]) => {
    log.debug(`giveBurritos called: giver=${giver}, updates=`, updates);
    return updates.reduce(async (prev: any, burrito) => {
        return prev.then(async () => {
            if (burrito.type === 'inc') {
                await BurritoStore.giveBurrito(burrito.username, giver);
            } else if (burrito.type === 'dec') {
                await BurritoStore.takeAwayBurrito(burrito.username, giver);
            }
        });
    }, Promise.resolve());
};

const notifyUser = (channel: string, user: string, message: string) => WBCHandler.sendEphemeralMessage(channel, user, message);

const handleBurritos = async (giver: string, updates: Updates[], channel: string) => {
    log.debug(`handleBurritos called: giver=${giver}, updates=`, updates, `channel=${channel}`);
    log.debug(`handleBurritos config: enableDecrement=${enableDecrement}, dailyCap=${dailyCap}, dailyDecCap=${dailyDecCap}`);

    if (enableDecrement) {
        const burritos = await BurritoStore.givenToday(giver, 'from', 'inc');
        log.debug(`handleBurritos (enableDecrement=true): burritos given today (inc only)=${burritos}`);
        const diff = dailyCap - burritos;
        log.debug(`handleBurritos (enableDecrement=true): diff=${diff}`);

        if (updates.length > diff) {
            notifyUser(channel, giver, `오늘 더 이상 신발을 전달할 수 없어요. 아쉽지만 내일 다시 이용해주세요.`);
            return false;
        }
        if (burritos >= dailyCap) {
            return false;
        }
        await giveBurritos(giver, updates);
        // Success message for increment burritos
        const incUpdates = updates.filter((x) => x.type === 'inc');
        if (incUpdates.length > 0) {
            const userNames = incUpdates.map(u => `<@${u.username}>`).join(', ');
            notifyUser(channel, giver, `${userNames}님에게 shoes가 전달되었어요.`);
        }
    } else {
        log.debug(`handleBurritos (enableDecrement=false) path`);
        const givenBurritos = await BurritoStore.givenToday(giver, 'from', 'inc');
        const givenRottenBurritos = await BurritoStore.givenToday(giver, 'from', 'dec');
        log.debug(`handleBurritos (enableDecrement=false): givenBurritos=${givenBurritos}, givenRottenBurritos=${givenRottenBurritos}`);

        const incUpdates = updates.filter((x) => x.type === 'inc');
        const decUpdates = updates.filter((x) => x.type === 'dec');
        const diffInc = dailyCap - givenBurritos;
        const diffDec = dailyDecCap - givenRottenBurritos;
        log.debug(`handleBurritos (enableDecrement=false): diffInc=${diffInc}, diffDec=${diffDec}`);

        if (incUpdates.length) {
            if (incUpdates.length > diffInc) {
                notifyUser(channel, giver, `오늘 더 이상 신발을 전달할 수 없어요. 아쉽지만 내일 다시 이용해주세요.`);
            } else {
                await giveBurritos(giver, incUpdates);
                const userNames = incUpdates.map(u => `<@${u.username}>`).join(', ');
                notifyUser(channel, giver, `${userNames}님에게 shoes가 전달되었어요.`);
            }
        }
        if (decUpdates.length) {
            if (decUpdates.length > diffDec) {
                notifyUser(channel, giver, `You are trying to give away ${updates.length} rottenburritos, but you only have ${diffDec} rottenburritos left today!`);
            } else {
                await giveBurritos(giver, decUpdates);
                const userNames = decUpdates.map(u => `<@${u.username}>`).join(', ');
                notifyUser(channel, giver, `${userNames}님에게 ${decUpdates.length}개의 낡은 shoes가 전달되었습니다.`);
            }
        }
    }
    return true;
};

const start = async () => {
    await app.start();
    console.log('⚡️ Bolt app is running!');

    app.message(async ({ message, say }) => {
        if (validMessage(message, emojis, LocalStore.getAllBots())) {
            if (validBotMention(message, LocalStore.botUserID())) {
                // Geather data and send back to user
            } else {
                const result = parseMessage(message, emojis);
                if (result) {
                    const { giver, updates } = result;
                    if (updates.length) {
                        await handleBurritos(giver, updates, message.channel);
                    }
                }
            }
        }
    });
};

export {
    handleBurritos,
    notifyUser,
    start,
};
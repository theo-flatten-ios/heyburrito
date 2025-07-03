import * as log from 'bog';
import config from '../config';

interface WbcParsed {
    id: string;
    name: string;
    avatar: string;
    memberType: string;
}

class Wbc {
    wbc: any;

    register(wbc: any) {
        this.wbc = wbc;
    }

    async fetchSlackUsers() {
        const users: WbcParsed[] = [];
        const bots: WbcParsed[] = [];

        log.info('Fetching slack users via wbc');
        log.debug('WBC WebClient token: ', this.wbc.token);
        const result = await this.wbc.users.list();
        result.members.forEach((x: any) => {
            // reassign correct array to arr
            const arr = x.is_bot ? bots : users;
            arr.push({
                id: x.id,
                name: x.is_bot ? x.name : x.real_name,
                memberType: x.is_restricted ? 'guest' : 'member',
                avatar: x.profile.image_48,
            });
        });
        return { users, bots };
    }

    async sendDM(username: string, text: string) {
        const res = await this.wbc.chat.postMessage({
            text,
            channel: username,
            username: config.slack.bot_name,
            icon_emoji: ':burrito:',
        });
        if (res.ok) {
            log.info(`Notified user ${username}`);
        }
    }

    async sendEphemeralMessage(channel: string, user: string, text: string) {
        const res = await this.wbc.chat.postEphemeral({
            channel,
            user,
            text,
            as_user: true,
        });
        if (res.ok) {
            log.info(`Sent ephemeral message to user ${user} in channel ${channel}`);
        }
    }
}

export default new Wbc();

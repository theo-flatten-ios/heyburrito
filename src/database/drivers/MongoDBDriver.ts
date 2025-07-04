import { time } from '../../lib/utils';
import * as log from 'bog';

const mongoConf = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

interface Find {
    _id: string;
    to: string;
    from: string;
    value: number;
    given_at: Date;
}

interface Sum {
    _id?: string; // Username
    score?: number;
}

class MongoDBDriver {
    constructor(
        public MongoClient: any,
        public conf: any = {},
        public client = null,
        public db = null,
    ) { }

    async connect() {
        log.debug('MongoDBDriver connect called');
        if (this.client && this.client.isConnected()) {
            log.debug('MongoDBDriver already connected');
            return this.client;
        }

        try {
            log.debug(`Connecting to MongoDB: ${this.conf.db_uri}`);
            const client = await this.MongoClient.connect(`${this.conf.db_uri}`, mongoConf);
            this.client = client;
            this.db = client.db(this.conf.db_database);
            log.debug('MongoDBDriver connected successfully');
            return true;
        } catch (e) {
            log.error('Could not connect to Mongodb server', e);
            throw new Error('Could not connect to Mongodb server');
        }
    }

    async store(collection: string, data: Object) {
        log.debug(`MongoDBDriver store called: collection=${collection}, data=`, data);
        await this.connect();
        const result = await this.db.collection(collection).insertOne(data);
        log.debug(`MongoDBDriver store result:`, result);
        return result;
    }

    give(to: string, from: string, date: any) {
        log.debug(`MongoDBDriver give called: to=${to}, from=${from}, date=${date}`);
        return this.store('burritos', {
            to,
            from,
            value: 1,
            given_at: date,
        });
    }

    takeAway(to: string, from: string, date: any) {
        log.debug(`MongoDBDriver takeAway called: to=${to}, from=${from}, date=${date}`);
        return this.store('burritos', {
            to,
            from,
            value: -1,
            given_at: date,
        });
    }

    /**
     * @param { string } collection -  like burrito
     * @param { Object } query - searchObject to search for
     * @return { Find[] }
     */
    async find(collection: string, query: Object): Promise<Find[]> {
        log.debug(`MongoDBDriver find called: collection=${collection}, query=`, query);
        await this.connect();
        const result = await this.db.collection(collection).find(query).toArray();
        log.debug(`MongoDBDriver find result:`, result);
        return result;
    }

    /**
     * @param { string } collection - burrito
     * @param { string | null } match - matchObject to search for
     * @param { string } listType - defaults to 'to'
     * @return { Object } sum[] - data
     */
    async sum(collection: string, match: Object = null, listType: string): Promise<Sum[]> {
        log.debug(`MongoDBDriver sum called: collection=${collection}, match=`, match, `listType=${listType}`);
        await this.connect();
        const aggregations: Array<Object> = [{ $match: { to: { $exists: true } } }];
        if (match) {
            aggregations.push({ $match: match });
        }
        aggregations.push({ $group: { _id: listType, score: { $sum: '$value' } } });
        aggregations.push({ $sort: { score: -1 } });
        const result = await this.db.collection(collection).aggregate(aggregations).toArray();
        log.debug(`MongoDBDriver sum result:`, result);
        return result;
    }

    /**
     * Finds all entrys associated to user today
     * @params { string } user => userid
     * @params { string } listtype => to / from
     * @returns {Find[]}
     */
    findFromToday(user: string, listType: string): Promise<Find[]> {
        const query = {
            [listType]: user,
            given_at: {
                $gte: time().start,
                $lt: time().end,
            },
        };
        log.debug(`MongoDBDriver findFromToday query for ${user} (${listType}):`, query);
        return this.find('burritos', query);
    }

    /**
     * Return specific userScore
     * @param {string} user - userId
     * @param {string} listType - to / from
     * @return {Object} sum[]
     */
    async getScore(user: string, listType: string, num = false) {
        log.debug(`MongoDBDriver getScore called: user=${user}, listType=${listType}, num=${num}`);
        const match = { [listType]: user };

        if (num) {
            const data = await this.sum('burritos', match, listType);
            log.debug(`MongoDBDriver getScore sum result:`, data);
            return data.length ? data[0].score : 0;
        }
        const result = await this.find('burritos', match);
        log.debug(`MongoDBDriver getScore find result:`, result);
        return result;
    }

    /**
     * Returns scoreboard
     * Should be able to return burrito List ( scoreType inc ) and
     * listtype ( dec ) AKA rottenburritoList
     */
    async getScoreBoard({ user, listType, today }) {
        log.debug(`MongoDBDriver getScoreBoard called: user=${user}, listType=${listType}, today=${today}`);
        let match: any = {};

        if (user) {
            match = (listType === 'from') ? { to: user } : { from: user };
        }
        if (today) {
            match.given_at = { $gte: time().start, $lt: time().end };
        }
        const result = await this.find('burritos', match);
        log.debug(`MongoDBDriver getScoreBoard find result:`, result);
        return result;
    }
}

export default MongoDBDriver;
import * as log from 'bog';
import { WebClient } from '@slack/web-api';
import { WebMock } from '../../test/lib/slackMock';
import config from '../config';

const { slackMock } = config.misc;

log.debug('Slack mockApi loaded', slackMock);

export default {
    wbc: slackMock ? new WebMock() : new WebClient(config.slack.api_token),
};

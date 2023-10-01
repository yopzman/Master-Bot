import { SapphireClient } from '@sapphire/framework';
import '@sapphire/plugin-hmr/register';
import { QueueClient } from '../music/classes/QueueClient';
import Redis from 'ioredis';
import {
	GatewayDispatchEvents,
	IntentsBitField,
	NewsChannel,
	TextChannel,
	ThreadChannel
} from 'discord.js';
import { deletePlayerEmbed } from '../music/buttonsCollector';
import type { ClientTwitchExtension } from './../../lib/twitch/twitchAPI-types';
import { TwitchAPI } from '../twitch/twitchAPI';
import Logger from '../logger';

export class ExtendedClient extends SapphireClient {
	readonly music: QueueClient;
	leaveTimers: { [key: string]: NodeJS.Timer };
	twitch: ClientTwitchExtension = {
		api: new TwitchAPI(
			process.env.TWITCH_CLIENT_ID,
			process.env.TWITCH_CLIENT_SECRET
		),
		auth: {
			access_token: '',
			refresh_token: '',
			expires_in: 0,
			token_type: '',
			scope: ['']
		},
		notifyList: {}
	};
	public constructor() {
		super({
			intents: [
				IntentsBitField.Flags.Guilds,
				IntentsBitField.Flags.GuildMembers,
				IntentsBitField.Flags.GuildMessages,
				IntentsBitField.Flags.GuildMessageReactions,
				IntentsBitField.Flags.GuildVoiceStates
			],
			logger: { level: 100 },
			loadMessageCommandListeners: true,
			hmr: {
				enabled: process.env.NODE_ENV === 'development'
			}
		});

		this.music = new QueueClient({
			sendGatewayPayload: (id, payload) =>
				this.guilds.cache.get(id)?.shard?.send(payload),
			options: {
				redis: new Redis({
					host: process.env.REDIS_HOST || 'localhost',
					port: Number.parseInt(process.env.REDIS_PORT!) || 6379,
					password: process.env.REDIS_PASSWORD || '',
					db: Number.parseInt(process.env.REDIS_DB!) || 0
				})
			},
			connection: {
				host: process.env.LAVA_HOST || '',
				password: process.env.LAVA_PASS || '',
				port: process.env.LAVA_PORT ? +process.env.LAVA_PORT : 1339,
				secure: process.env.LAVA_SECURE === 'true' ? true : false
			}
		});

		this.ws.on(GatewayDispatchEvents.VoiceServerUpdate, async data => {
			await this.music.handleVoiceUpdate(data);
		});

		this.ws.on(GatewayDispatchEvents.VoiceStateUpdate, async data => {
			// handle if a mod right-clicks disconnect on the bot
			if (!data.channel_id && data.user_id == this.application?.id) {
				const queue = this.music.queues.get(data.guild_id);
				await deletePlayerEmbed(queue);
				await queue.clear();
				queue.destroyPlayer();
			}
			await this.music.handleVoiceUpdate(data);
		});

		if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
			this.twitch.api?.getAccessToken('user:read:email').then(response => {
				this.twitch.auth = {
					access_token: response.access_token,
					refresh_token: response.refresh_token,
					expires_in: response.expires_in,
					token_type: response.token_type,
					scope: response.scope
				};
			});

			setInterval(() => {
				this.twitch.api
					?.getAccessToken('user:read:email')
					.then(response => {
						this.twitch.auth = {
							access_token: response.access_token,
							refresh_token: response.refresh_token,
							expires_in: response.expires_in,
							token_type: response.token_type,
							scope: response.scope
						};
					})
					.catch(error => {
						Logger.error(error);
					});
			}, 4.32e7); // refresh every 12 hours
		} else {
			Logger.info('Twitch-Features are Disabled');
		}

		this.leaveTimers = {};
	}
}
export type MessageChannel = TextChannel | ThreadChannel | NewsChannel | null;

declare module '@sapphire/framework' {
	interface SapphireClient {
		readonly music: QueueClient;
		leaveTimers: { [key: string]: NodeJS.Timer };
		twitch: ClientTwitchExtension;
	}
}

declare module 'lavaclient' {
	interface Player {
		nightcore: boolean;
		vaporwave: boolean;
		karaoke: boolean;
		bassboost: boolean;
	}
}

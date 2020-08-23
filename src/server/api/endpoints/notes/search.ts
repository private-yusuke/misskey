import $ from 'cafy';
import es from '../../../../db/elasticsearch';
import define from '../../define';
import { Notes, Users } from '../../../../models';
import { In, Brackets } from 'typeorm';
import { ID } from '../../../../misc/cafy-id';
import config from '../../../../config';
import { makePaginationQuery } from '../../common/make-pagination-query';
import { generateVisibilityQuery } from '../../common/generate-visibility-query';
import { generateMutedUserQuery } from '../../common/generate-muted-user-query';
import { toPunyNullable } from '../../../../misc/convert-host';
import { IUser } from '../../../../models/entities/user';
import { safeForSql } from '../../../../misc/safe-for-sql';

export const meta = {
	desc: {
		'ja-JP': '投稿を検索します。',
		'en-US': 'Search notes.'
	},

	tags: ['notes'],

	requireCredential: false as const,

	params: {
		query: {
			validator: $.str
		},

		sinceId: {
			validator: $.optional.type(ID),
		},

		untilId: {
			validator: $.optional.type(ID),
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		host: {
			validator: $.optional.nullable.str,
			default: undefined
		},

		userId: {
			validator: $.optional.nullable.type(ID),
			default: null
		},
	},

	res: {
		type: 'array' as const,
		optional: false as const, nullable: false as const,
		items: {
			type: 'object' as const,
			optional: false as const, nullable: false as const,
			ref: 'Note',
		}
	},

	errors: {
	}
};

export default define(meta, async (ps, me) => {
	if (es == null) {
		const query = makePaginationQuery(Notes.createQueryBuilder('note'), ps.sinceId, ps.untilId)
			.leftJoinAndSelect('note.user', 'user');

		let from: IUser | null  = null;
		const toUsers: IUser[] = [];
		const excludeFroms: IUser[] = [];
		const excludeToUsers: IUser[] = [];
		const words: string[] = [];
		const excludeWords: string[] = [];
		let withFiles = false;
		let withPolls: boolean | null = null;
		let withCw: boolean | null = null;
		let since: Date | null = null;
		let until: Date | null = null;
		const fromRegex = /^from:@?([\w-]+)(?:@([\w.-]+))?$/;
		const toRegex = /^to:@?([\w-]+)(?:@([\w.-]+))?$/;
		const pollsRegex = /^(poll|polls)$/i;
		const cwRegex = /cw/i;
		const filterRegex = /^filter:(\w+)$/;
		const tokens = ps.query.trim().match(/(?:[^\s"']+|['"][^'"]*["'])+/g);
		if (tokens == null) return [];
		for (let token of tokens) {
			token = token.replace(/(['"])/g, '');
			const matchFrom = token.match(fromRegex);
			if (matchFrom) {
				const user = await getUser(matchFrom[1], matchFrom[2]);
				if (user == null) {
					return [];
				} else {
					from = user;
					continue;
				}
			}

			const matchFile = token.match(/^filetype:(\w+)$/);
			if (matchFile) {
				if (matchFile[1] === 'all') {
					withFiles = true;
					continue;
				} else {
					return [];
				}
			}

			const matchTo = token.match(toRegex);
			if (matchTo) {
				const user = await getUser(matchTo[1], matchTo[2]);
				if (user == null) {
					return [];
				} else {
					toUsers.push(user);
					continue;
				}
			}

			const matchSince = token.match(/^since:(\d{4}-\d{1,2}-\d{1,2})/);
			if (matchSince) {
				since = new Date(`${matchSince[1]} 00:00:00 +0900`);
				if (isNaN(since.getTime())) return [];
				continue;
			}

			const matchUntil = token.match(/^until:(\d{4}-\d{1,2}-\d{1,2})/);
			if (matchUntil) {
				until = new Date(`${matchUntil[1]} 23:59:59 +0900`);
				if (isNaN(until.getTime())) return [];
				continue;
			}

			const matchFilter = token.match(filterRegex);
			if (matchFilter) {
				const replacedWord = token.replace(/^filter:/, '');
				const matchPolls = replacedWord.match(pollsRegex);
				if (matchPolls) {
					withPolls = true;
					continue;
				}

				const matchCw = replacedWord.match(cwRegex);
				if (matchCw) {
					withCw = true;
					continue;
				}
				return [];
			}

			const matchExcludeWord = token.match(/^-/);
			if (matchExcludeWord) {
				const replacedWord = token.replace(/^-/, '');
				const matchFrom = replacedWord.match(fromRegex);
				if (matchFrom) {
					const user = await getUser(matchFrom[1], matchFrom[2]);
					if (user == null) {
						return [];
					} else {
						excludeFroms.push(user);
						continue;
					}
				}

				const matchToUser = replacedWord.match(toRegex);
				if (matchToUser) {
					const user = await getUser(matchToUser[1], matchToUser[2]);
					if (user == null) {
						return[];
					} else {
						excludeToUsers.push(user);
						continue;
					}
				}

				excludeWords.push(replacedWord);
				continue;
			}
			words.push(token);
		}

		if (from) {
			query.andWhere('note.userId = :userId', { userId: from.id });
		}
		if (toUsers.length > 0) {
			query.andWhere(new Brackets(qb => {
				for (const toUser of toUsers) {
					if (!safeForSql(toUser.id)) return;
					qb.andWhere(':toUser.id = ANY (note.mentions)', { toUser: toUser.id });
				}
			}));
		}
		if (withFiles) {
			query.andWhere('note.fileIds != :fileId', { fileId: '{}' });
		}
		if (withPolls != null) {
			query.andWhere('note.hasPoll = :withPolls', { withPolls: withPolls });
		}
		if (withCw == true) {
			query.andWhere('note.cw IS NOT NULL');
		} else if (withCw == false) {
			query.andWhere('note.cw IS NULL');
		}
		if (since) {
			query.andWhere('note.createdAt >= :since', { since: since });
		}
		if (until) {
			query.andWhere('note.createdAt <= :until', { until: until });
		}
		if (excludeWords.length > 0) {
			query.andWhere(new Brackets(qb => {
				let count = 0;
				for (const excludeWord of excludeWords) {
					if (!safeForSql(excludeWord)) return;
					qb.andWhere(`note.text NOT ILIKE :excludeWord_${count}`, { [`excludeWord_${count}`]: `%${excludeWord}%` });
					count++;
				}
			}));
		}
		if (excludeFroms.length > 0) {
			query.andWhere(new Brackets(qb => {
				let count = 0;
				for (const excludeFrom of excludeFroms) {
					qb.andWhere(`note.userId != :excludeFromUserId_${count}`, { [`excludeFromUserId_${count}`]: excludeFrom.id });
					count++;
				}
			}));
		}
		if (excludeToUsers.length > 0) {
			query.andWhere(new Brackets(qb => {
				for (const excludeToUser of excludeToUsers) {
					qb.andWhere(':excludeToUser != ALL (note.mentions)', { excludeToUser: excludeToUser.id });
				}
			}));
		}
		if (words.length > 0) {
			query.andWhere(new Brackets(qb => {
				let count = 0;
				for (const word of words) {
					if (!safeForSql(word)) return;
					qb.andWhere(`note.text ILIKE :word_${count}`, { [`word_${count}`]: `%${word}%` });
					count++;
				}
			}));
		}
		generateVisibilityQuery(query, me);
		if (me) generateMutedUserQuery(query, me);

		const notes = await query.take(ps.limit!).getMany();

		return await Notes.packMany(notes, me);
	} else {
		const userQuery = ps.userId != null ? [{
			term: {
				userId: ps.userId
			}
		}] : [];

		const hostQuery = ps.userId == null ?
			ps.host === null ? [{
				bool: {
					must_not: {
						exists: {
							field: 'userHost'
						}
					}
				}
			}] : ps.host !== undefined ? [{
				term: {
					userHost: ps.host
				}
			}] : []
		: [];

		const result = await es.search({
			index: config.elasticsearch.index || 'misskey_note',
			body: {
				size: ps.limit!,
				from: ps.offset,
				query: {
					bool: {
						must: [{
							simple_query_string: {
								fields: ['text'],
								query: ps.query.toLowerCase(),
								default_operator: 'and'
							},
						}, ...hostQuery, ...userQuery]
					}
				},
				sort: [{
					_doc: 'desc'
				}]
			}
		});

		const hits = result.body.hits.hits.map((hit: any) => hit._id);

		if (hits.length === 0) return [];

		// Fetch found notes
		const notes = await Notes.find({
			where: {
				id: In(hits)
			},
			order: {
				id: -1
			}
		});

		return await Notes.packMany(notes, me);
	}
});

const getUser = async (username: string, host: string): Promise<IUser | null>  => {
	if (!safeForSql(username)) return null;
	if (!safeForSql(host)) return null;
	const user = await Users.findOne({
		usernameLower: username.toLowerCase(),
		host: toPunyNullable(host),
	});
	if (user == null) return null;
	return user;
};

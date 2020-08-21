import $ from 'cafy';
import es from '../../../../db/elasticsearch';
import define from '../../define';
import { Notes, Users } from '../../../../models';
import { In } from 'typeorm';
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
		let words: string = '';
		let withFiles = false;
		const tokens = ps.query.trim().split(/\s+/);
		for (const token of tokens) {
			const matchFrom = token.match(/^from:@?([\w-]+)(?:@([\w.-]+))?$/);
			if (matchFrom) {
				if (!safeForSql(matchFrom[1])) return [];
				if (!safeForSql(matchFrom[2])) return [];
				const user = await Users.findOne({
					usernameLower: matchFrom[1].toLowerCase(),
					host: toPunyNullable(matchFrom[2]),
				});
				if (user == null) return [];
				from = user;
				continue;
			}

			const matchFile = token.match(/^file:(\w+)$/);
			if (matchFile) {
				if (matchFile[1] === 'all') {
					withFiles = true;
					continue;
				} else {
					return [];
				}
			}
			words += token;
		}

		if (from) {
			query.andWhere('note.userId = :userId', { userId: from.id });
		}
		if (withFiles) {
			query.andWhere('note.fileIds != :fileId', { fileId: '{}' });
		}
		if (words.length > 0) {
			query.andWhere('note.text ILIKE :q', { q: `%${words}%` });
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

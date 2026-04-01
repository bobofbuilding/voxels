////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Types for /api/announcements messages

import * as t from 'io-ts'
import { NullableNum, NullableStr } from './feature'

export const PosterRecord = t.type(
  {
    extras: NullableStr,
    description: t.string,
    user_id: t.number,
    primary_group_id: t.number,
    flair_group_id: NullableNum,
  },
  'PosterRecord',
)
export type PosterRecord = t.TypeOf<typeof PosterRecord>

export const TopicRecord = t.type(
  {
    id: t.number,
    title: t.string,
    fancy_title: t.string,
    slug: t.string,
    posts_count: t.number,
    reply_count: t.number,
    highest_post_number: t.number,
    image_url: NullableStr,
    created_at: t.string,
    last_posted_at: t.string,
    bumped: t.boolean,
    bumped_at: t.string,
    archetype: t.string,
    unseen: t.boolean,
    pinned: t.boolean,
    unpinned: t.null, // todo figure out what else it can be
    visible: t.boolean,
    closed: t.boolean,
    archived: t.boolean,
    bookmarked: t.null,
    liked: t.null,
    unicode_title: t.union([t.string, t.undefined]),
    tags: t.array(t.string),
    views: t.number,
    like_count: t.number,
    has_summary: t.boolean,
    last_poster_username: t.string,
    category_id: t.number,
    pinned_globally: t.boolean,
    featured_link: NullableStr,
    has_accepted_answer: t.boolean,
    posters: t.array(PosterRecord),
  },
  'TopicRecord',
)
export type TopicRecord = t.TypeOf<typeof TopicRecord>

/**
 * /api/announcements/topics.json
 */
export const ApiAnnouncementsTopics = t.type(
  {
    success: t.boolean,
    topics: t.array(TopicRecord),
  },
  'ApiAnnouncementsTopics',
)
export type ApiAnnouncementsTopics = t.TypeOf<typeof ApiAnnouncementsTopics>

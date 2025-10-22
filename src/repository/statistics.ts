"use server";

import { db } from "@/drizzle/db";
import { sql } from "drizzle-orm";
import { getEnvConfig } from "@/lib/config";
import type {
  TimeRange,
  DatabaseStatRow,
  DatabaseUser,
  DatabaseKeyStatRow,
  DatabaseKey,
} from "@/types/statistics";

/**
 * 根据时间范围获取用户消费和API调用统计
 * 注意：这个函数使用原生SQL，因为涉及到PostgreSQL特定的generate_series函数
 */
export async function getUserStatisticsFromDB(timeRange: TimeRange): Promise<DatabaseStatRow[]> {
  const timezone = getEnvConfig().TZ;
  let query;

  switch (timeRange) {
    case "today":
      // 今天（小时分辨率）
      query = sql`
        WITH hour_range AS (
          SELECT generate_series(
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())),
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())) + INTERVAL '23 hours',
            '1 hour'::interval
          ) AS hour
        ),
        hourly_stats AS (
          SELECT
            u.id AS user_id,
            u.name AS user_name,
            hr.hour,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM users u
          CROSS JOIN hour_range hr
          LEFT JOIN message_request mr ON u.id = mr.user_id
            AND DATE_TRUNC('hour', mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) = hr.hour
            AND mr.deleted_at IS NULL
          WHERE u.deleted_at IS NULL
          GROUP BY u.id, u.name, hr.hour
        )
        SELECT
          user_id,
          user_name,
          hour AS date,
          api_calls::integer,
          total_cost::numeric
        FROM hourly_stats
        ORDER BY hour ASC, user_name ASC
      `;
      break;

    case "7days":
      // 过去7天（天分辨率）
      query = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '6 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        daily_stats AS (
          SELECT
            u.id AS user_id,
            u.name AS user_name,
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM users u
          CROSS JOIN date_range dr
          LEFT JOIN message_request mr ON u.id = mr.user_id
            AND (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.deleted_at IS NULL
          WHERE u.deleted_at IS NULL
          GROUP BY u.id, u.name, dr.date
        )
        SELECT
          user_id,
          user_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC, user_name ASC
      `;
      break;

    case "30days":
      // 过去 30 天（天分辨率）
      query = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '29 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        daily_stats AS (
          SELECT
            u.id AS user_id,
            u.name AS user_name,
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM users u
          CROSS JOIN date_range dr
          LEFT JOIN message_request mr ON u.id = mr.user_id
            AND (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.deleted_at IS NULL
          WHERE u.deleted_at IS NULL
          GROUP BY u.id, u.name, dr.date
        )
        SELECT
          user_id,
          user_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC, user_name ASC
      `;
      break;

    default:
      throw new Error(`Unsupported time range: ${timeRange}`);
  }

  const result = await db.execute(query);
  return Array.from(result) as unknown as DatabaseStatRow[];
}

/**
 * 获取所有活跃用户列表
 */
export async function getActiveUsersFromDB(): Promise<DatabaseUser[]> {
  const query = sql`
    SELECT id, name
    FROM users
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  `;

  const result = await db.execute(query);
  return Array.from(result) as unknown as DatabaseUser[];
}

/**
 * 获取指定用户的密钥使用统计
 */
export async function getKeyStatisticsFromDB(
  userId: number,
  timeRange: TimeRange
): Promise<DatabaseKeyStatRow[]> {
  const timezone = getEnvConfig().TZ;
  let query;

  switch (timeRange) {
    case "today":
      query = sql`
        WITH hour_range AS (
          SELECT generate_series(
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())),
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())) + INTERVAL '23 hours',
            '1 hour'::interval
          ) AS hour
        ),
        user_keys AS (
          SELECT id, name, key
          FROM keys
          WHERE user_id = ${userId}
            AND deleted_at IS NULL
        ),
        hourly_stats AS (
          SELECT
            k.id AS key_id,
            k.name AS key_name,
            hr.hour,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM user_keys k
          CROSS JOIN hour_range hr
          LEFT JOIN message_request mr ON mr.key = k.key
            AND mr.user_id = ${userId}
            AND DATE_TRUNC('hour', mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) = hr.hour
            AND mr.deleted_at IS NULL
          GROUP BY k.id, k.name, hr.hour
        )
        SELECT
          key_id,
          key_name,
          hour AS date,
          api_calls::integer,
          total_cost::numeric
        FROM hourly_stats
        ORDER BY hour ASC, key_name ASC
      `;
      break;

    case "7days":
      query = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '6 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        user_keys AS (
          SELECT id, name, key
          FROM keys
          WHERE user_id = ${userId}
            AND deleted_at IS NULL
        ),
        daily_stats AS (
          SELECT
            k.id AS key_id,
            k.name AS key_name,
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM user_keys k
          CROSS JOIN date_range dr
          LEFT JOIN message_request mr ON mr.key = k.key
            AND mr.user_id = ${userId}
            AND (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.deleted_at IS NULL
          GROUP BY k.id, k.name, dr.date
        )
        SELECT
          key_id,
          key_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC, key_name ASC
      `;
      break;

    case "30days":
      query = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '29 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        user_keys AS (
          SELECT id, name, key
          FROM keys
          WHERE user_id = ${userId}
            AND deleted_at IS NULL
        ),
        daily_stats AS (
          SELECT
            k.id AS key_id,
            k.name AS key_name,
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM user_keys k
          CROSS JOIN date_range dr
          LEFT JOIN message_request mr ON mr.key = k.key
            AND mr.user_id = ${userId}
            AND (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.deleted_at IS NULL
          GROUP BY k.id, k.name, dr.date
        )
        SELECT
          key_id,
          key_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC, key_name ASC
      `;
      break;

    default:
      throw new Error(`Unsupported time range: ${timeRange}`);
  }

  const result = await db.execute(query);
  return Array.from(result) as unknown as DatabaseKeyStatRow[];
}

/**
 * 获取指定用户的有效密钥列表
 */
export async function getActiveKeysForUserFromDB(userId: number): Promise<DatabaseKey[]> {
  const query = sql`
    SELECT id, name
    FROM keys
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
    ORDER BY name ASC
  `;

  const result = await db.execute(query);
  return Array.from(result) as unknown as DatabaseKey[];
}

/**
 * 获取混合统计数据：当前用户的密钥明细 + 其他用户的汇总
 * 用于非 admin 用户在 allowGlobalUsageView=true 时的数据展示
 */
export async function getMixedStatisticsFromDB(
  userId: number,
  timeRange: TimeRange
): Promise<{
  ownKeys: DatabaseKeyStatRow[];
  othersAggregate: DatabaseStatRow[];
}> {
  const timezone = getEnvConfig().TZ;
  let ownKeysQuery;
  let othersQuery;

  switch (timeRange) {
    case "today":
      // 自己的密钥明细（小时分辨率）
      ownKeysQuery = sql`
        WITH hour_range AS (
          SELECT generate_series(
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())),
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())) + INTERVAL '23 hours',
            '1 hour'::interval
          ) AS hour
        ),
        user_keys AS (
          SELECT id, name, key
          FROM keys
          WHERE user_id = ${userId}
            AND deleted_at IS NULL
        ),
        hourly_stats AS (
          SELECT
            k.id AS key_id,
            k.name AS key_name,
            hr.hour,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM user_keys k
          CROSS JOIN hour_range hr
          LEFT JOIN message_request mr ON mr.key = k.key
            AND mr.user_id = ${userId}
            AND DATE_TRUNC('hour', mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) = hr.hour
            AND mr.deleted_at IS NULL
          GROUP BY k.id, k.name, hr.hour
        )
        SELECT
          key_id,
          key_name,
          hour AS date,
          api_calls::integer,
          total_cost::numeric
        FROM hourly_stats
        ORDER BY hour ASC, key_name ASC
      `;

      // 其他用户汇总（小时分辨率）
      othersQuery = sql`
        WITH hour_range AS (
          SELECT generate_series(
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())),
            DATE_TRUNC('day', TIMEZONE(${timezone}, NOW())) + INTERVAL '23 hours',
            '1 hour'::interval
          ) AS hour
        ),
        hourly_stats AS (
          SELECT
            hr.hour,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM hour_range hr
          LEFT JOIN message_request mr ON DATE_TRUNC('hour', mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) = hr.hour
            AND mr.user_id != ${userId}
            AND mr.deleted_at IS NULL
          GROUP BY hr.hour
        )
        SELECT
          -1 AS user_id,
          '其他用户' AS user_name,
          hour AS date,
          api_calls::integer,
          total_cost::numeric
        FROM hourly_stats
        ORDER BY hour ASC
      `;
      break;

    case "7days":
      // 自己的密钥明细（天分辨率）
      ownKeysQuery = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '6 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        user_keys AS (
          SELECT id, name, key
          FROM keys
          WHERE user_id = ${userId}
            AND deleted_at IS NULL
        ),
        daily_stats AS (
          SELECT
            k.id AS key_id,
            k.name AS key_name,
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM user_keys k
          CROSS JOIN date_range dr
          LEFT JOIN message_request mr ON mr.key = k.key
            AND mr.user_id = ${userId}
            AND (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.deleted_at IS NULL
          GROUP BY k.id, k.name, dr.date
        )
        SELECT
          key_id,
          key_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC, key_name ASC
      `;

      // 其他用户汇总（天分辨率）
      othersQuery = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '6 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        daily_stats AS (
          SELECT
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM date_range dr
          LEFT JOIN message_request mr ON (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.user_id != ${userId}
            AND mr.deleted_at IS NULL
          GROUP BY dr.date
        )
        SELECT
          -1 AS user_id,
          '其他用户' AS user_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC
      `;
      break;

    case "30days":
      // 自己的密钥明细（天分辨率）
      ownKeysQuery = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '29 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        user_keys AS (
          SELECT id, name, key
          FROM keys
          WHERE user_id = ${userId}
            AND deleted_at IS NULL
        ),
        daily_stats AS (
          SELECT
            k.id AS key_id,
            k.name AS key_name,
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM user_keys k
          CROSS JOIN date_range dr
          LEFT JOIN message_request mr ON mr.key = k.key
            AND mr.user_id = ${userId}
            AND (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.deleted_at IS NULL
          GROUP BY k.id, k.name, dr.date
        )
        SELECT
          key_id,
          key_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC, key_name ASC
      `;

      // 其他用户汇总（天分辨率）
      othersQuery = sql`
        WITH date_range AS (
          SELECT generate_series(
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date - INTERVAL '29 days',
            (CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date,
            '1 day'::interval
          )::date AS date
        ),
        daily_stats AS (
          SELECT
            dr.date,
            COUNT(mr.id) AS api_calls,
            COALESCE(SUM(mr.cost_usd), 0) AS total_cost
          FROM date_range dr
          LEFT JOIN message_request mr ON (mr.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date = dr.date
            AND mr.user_id != ${userId}
            AND mr.deleted_at IS NULL
          GROUP BY dr.date
        )
        SELECT
          -1 AS user_id,
          '其他用户' AS user_name,
          date,
          api_calls::integer,
          total_cost::numeric
        FROM daily_stats
        ORDER BY date ASC
      `;
      break;

    default:
      throw new Error(`Unsupported time range: ${timeRange}`);
  }

  const [ownKeysResult, othersResult] = await Promise.all([
    db.execute(ownKeysQuery),
    db.execute(othersQuery),
  ]);

  return {
    ownKeys: Array.from(ownKeysResult) as unknown as DatabaseKeyStatRow[],
    othersAggregate: Array.from(othersResult) as unknown as DatabaseStatRow[],
  };
}

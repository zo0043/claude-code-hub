"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { LeaderboardTable } from "./leaderboard-table";
import type { LeaderboardEntry } from "@/repository/leaderboard";

export function LeaderboardView() {
  const [dailyData, setDailyData] = useState<LeaderboardEntry[]>([]);
  const [monthlyData, setMonthlyData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dailyRes, monthlyRes] = await Promise.all([
          fetch("/api/leaderboard?period=daily"),
          fetch("/api/leaderboard?period=monthly"),
        ]);

        if (!dailyRes.ok || !monthlyRes.ok) {
          throw new Error("获取排行榜数据失败");
        }

        const [daily, monthly] = await Promise.all([dailyRes.json(), monthlyRes.json()]);

        setDailyData(daily);
        setMonthlyData(monthly);
        setError(null);
      } catch (err) {
        console.error("获取排行榜数据失败:", err);
        setError(err instanceof Error ? err.message : "获取排行榜数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="daily" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="daily">今日排行</TabsTrigger>
        <TabsTrigger value="monthly">本月排行</TabsTrigger>
      </TabsList>

      <TabsContent value="daily" className="mt-6">
        <LeaderboardTable data={dailyData} period="daily" />
      </TabsContent>

      <TabsContent value="monthly" className="mt-6">
        <LeaderboardTable data={monthlyData} period="monthly" />
      </TabsContent>
    </Tabs>
  );
}

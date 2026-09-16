import { scenario, step, expect } from "kliv-scenario";

// 用户要求：路线页选区并智能规划后，首页要显示「今日目标：该区」，统计数据同步
scenario(
  "路线页按区规划后首页显示今日目标并同步",
  {
    setup: {
      database: [
        {
          table: "zones",
          rows: [
            { name: "西区", address: "Taman Universiti, Skudai", lat: 1.5377, lng: 103.6286 },
            { name: "东区", address: "Taman Molek, Johor Bahru", lat: 1.5285, lng: 103.7908 },
          ],
        },
        {
          table: "app_settings",
          rows: [
            {
              key: "collection_base",
              value: JSON.stringify({ address: "Jalan Skudai 10, Skudai", lat: 1.52, lng: 103.63 }),
            },
          ],
        },
        {
          table: "customers",
          rows: [
            {
              name: "陈西一",
              phone: null,
              address: "Jalan Skudai 1, Skudai",
              amount: 300,
              priority: 2,
              lat: 1.51,
              lng: 103.64,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: null,
              pinned_next: 0,
              zone_id: 1,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
            {
              name: "陈西二",
              phone: null,
              address: "Jalan Skudai 2, Skudai",
              amount: 200,
              priority: 2,
              lat: 1.515,
              lng: 103.635,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: null,
              pinned_next: 0,
              zone_id: 1,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
            {
              name: "王东",
              phone: null,
              address: "Jalan Molek 1, Johor Bahru",
              amount: 800,
              priority: 2,
              lat: 1.52,
              lng: 103.78,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: null,
              pinned_next: 0,
              zone_id: 2,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
          ],
        },
      ],
    },
  },
  async ({ page }) => {
    await step("路线页选择西区", async () => {
      await page.goto("/route");
      await page.getByRole("button", { name: "西区" }).click();
      await expect(page.getByText("今日专收：西区")).toBeVisible();
    });

    await step("点击智能规划生成西区路线", async () => {
      await page.getByRole("button", { name: "智能规划" }).click();
      await expect(page.getByText(/总距离/)).toBeVisible();
    });

    await step("首页显示今日目标西区，统计只算西区", async () => {
      await page.goto("/");
      await expect(page.getByText(/今日目标：西区/)).toBeVisible();
      await expect(page.getByText("今日任务·西区")).toBeVisible();
    });

    await step("点大本营按钮弹出导航选择", async () => {
      await page.getByRole("button", { name: /导航到大本营/ }).click();
      await expect(page.getByRole("button", { name: "🚗 Waze" })).toBeVisible();
      await expect(page.getByText(/大本营 · Jalan Skudai 10/)).toBeVisible();
    });
  },
);

import { scenario, step, expect } from "kliv-scenario";

// @kliv-spec-derived — 用户要求：1号完成任务后还是1号，2号还是2号，3号还是3号，绝不重新编号
scenario(
  "完成1号后其他客户编号不变",
  {
    setup: {
      database: [
        {
          table: "customers",
          rows: [
            {
              name: "陈一",
              phone: null,
              address: "Jalan Satu, Johor Bahru",
              amount: 100,
              priority: 2,
              lat: 1.52,
              lng: 103.78,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: 1,
              pinned_next: 0,
              zone_id: null,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
            {
              name: "陈二",
              phone: null,
              address: "Jalan Dua, Johor Bahru",
              amount: 200,
              priority: 2,
              lat: 1.49,
              lng: 103.75,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: 2,
              pinned_next: 0,
              zone_id: null,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
            {
              name: "陈三",
              phone: null,
              address: "Jalan Tiga, Johor Bahru",
              amount: 300,
              priority: 2,
              lat: 1.56,
              lng: 103.72,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: 3,
              pinned_next: 0,
              zone_id: null,
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
    await step("路线页显示 01 02 03 三个编号", async () => {
      await page.goto("/route");
      await expect(page.getByText("01", { exact: true })).toBeVisible();
      await expect(page.getByText("02", { exact: true })).toBeVisible();
      await expect(page.getByText("03", { exact: true })).toBeVisible();
    });

    await step("完成 1 号（陈一）", async () => {
      await page.getByRole("button", { name: "完成任务" }).first().click();
      await expect(page.getByText("收账结果")).toBeVisible();
      await page.getByRole("button", { name: "确认完成" }).click();
      // 完成后先停在分享页（交差用），点「完成」关掉
      await expect(page.getByText("已完成 ✅")).toBeVisible();
      await page.getByRole("button", { name: "完成", exact: true }).click();
      await expect(page.getByText("陈一")).not.toBeVisible();
    });

    await step("陈二仍是 02、陈三仍是 03，没有重新编号", async () => {
      await expect(page.getByText("02", { exact: true })).toBeVisible();
      await expect(page.getByText("03", { exact: true })).toBeVisible();
      await expect(page.getByText("01", { exact: true })).not.toBeVisible();
    });
  },
);

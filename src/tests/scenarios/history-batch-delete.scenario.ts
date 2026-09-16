import { scenario, step, expect } from "kliv-scenario";

// @kliv-spec-derived — 用户要求：收账历史可以多选然后一键删除
scenario(
  "收账历史多选一键删除",
  {
    setup: {
      database: [
        {
          table: "customers",
          rows: [
            {
              name: "陈一",
              phone: null,
              address: "Jalan Satu",
              amount: 100,
              priority: 2,
              lat: 1.52,
              lng: 103.78,
              geo_status: "ok",
              status: "done",
              notes: null,
              task_date: "2026-09-16",
              route_order: 1,
              pinned_next: 0,
              zone_id: null,
              completed_at: 1793640000,
              collected_amount: 100,
              archived: 1,
            },
            {
              name: "陈二",
              phone: null,
              address: "Jalan Dua",
              amount: 200,
              priority: 2,
              lat: 1.49,
              lng: 103.75,
              geo_status: "ok",
              status: "done",
              notes: null,
              task_date: "2026-09-16",
              route_order: 2,
              pinned_next: 0,
              zone_id: null,
              completed_at: 1793640000,
              collected_amount: 200,
              archived: 1,
            },
            {
              name: "陈三",
              phone: null,
              address: "Jalan Tiga",
              amount: 300,
              priority: 2,
              lat: 1.56,
              lng: 103.72,
              geo_status: "ok",
              status: "done",
              notes: null,
              task_date: "2026-09-16",
              route_order: 3,
              pinned_next: 0,
              zone_id: null,
              completed_at: 1793640000,
              collected_amount: 300,
              archived: 1,
            },
          ],
        },
        {
          table: "collection_history",
          rows: [
            {
              customer_id: 1,
              customer_name: "陈一",
              result: "已收款",
              collected_amount: 100,
              notes: null,
              lat: null,
              lng: null,
              recorded_at: 1793640100,
            },
            {
              customer_id: 2,
              customer_name: "陈二",
              result: "已收款",
              collected_amount: 200,
              notes: null,
              lat: null,
              lng: null,
              recorded_at: 1793640200,
            },
            {
              customer_id: 3,
              customer_name: "陈三",
              result: "已收款",
              collected_amount: 300,
              notes: null,
              lat: null,
              lng: null,
              recorded_at: 1793640300,
            },
          ],
        },
      ],
    },
  },
  async ({ page }) => {
    await step("历史页显示 3 笔记录", async () => {
      await page.goto("/history");
      await expect(page.getByText("共 3 笔记录")).toBeVisible();
      await expect(page.getByText("陈一")).toBeVisible();
    });

    await step("进入多选并勾选两位客户", async () => {
      await page.getByRole("button", { name: "多选" }).click();
      await page.getByRole("button", { name: "选择 陈二" }).click();
      await page.getByRole("button", { name: "选择 陈三" }).click();
      await expect(page.getByText("已选 2 条")).toBeVisible();
    });

    await step("一键删除所选并确认", async () => {
      await page.getByRole("button", { name: /删除所选/ }).click();
      await expect(page.getByText("删除所选的 2 条记录？")).toBeVisible();
      await page.getByRole("button", { name: "确认删除" }).click();
    });

    await step("只剩 1 笔记录，累计金额同步减少", async () => {
      await expect(page.getByText("共 1 笔记录")).toBeVisible();
      await expect(page.getByText("累计收款 RM 100.00")).toBeVisible();
      await expect(page.getByText("陈二")).not.toBeVisible();
    });
  },
);

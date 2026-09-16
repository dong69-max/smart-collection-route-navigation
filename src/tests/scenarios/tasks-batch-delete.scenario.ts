import { scenario, step, expect } from "kliv-scenario";

// @kliv-spec-derived — 用户要求：今日任务可以多选然后一键删除
scenario(
  "今日任务多选一键删除",
  {
    setup: {
      database: [
        {
          table: "customers",
          rows: [
            {
              name: "周一",
              phone: null,
              address: "Jalan Satu",
              amount: 100,
              priority: 2,
              lat: 1.52,
              lng: 103.78,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: null,
              pinned_next: 0,
              zone_id: null,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
            {
              name: "周二",
              phone: null,
              address: "Jalan Dua",
              amount: 200,
              priority: 2,
              lat: 1.49,
              lng: 103.75,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: null,
              pinned_next: 0,
              zone_id: null,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
            {
              name: "周三",
              phone: null,
              address: "Jalan Tiga",
              amount: 300,
              priority: 2,
              lat: 1.56,
              lng: 103.72,
              geo_status: "ok",
              status: "pending",
              notes: null,
              task_date: "2026-09-16",
              route_order: null,
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
    await step("任务页显示 3 位待收客户", async () => {
      await page.goto("/tasks");
      await expect(page.getByText("周一")).toBeVisible();
      await expect(page.getByText("周三")).toBeVisible();
    });

    await step("进入多选并勾选两位客户", async () => {
      await page.getByRole("button", { name: "多选" }).click();
      await page.getByRole("button", { name: "选择 周一" }).click();
      await page.getByRole("button", { name: "选择 周三" }).click();
      await expect(page.getByText("已选 2 位")).toBeVisible();
    });

    await step("一键删除所选并确认", async () => {
      await page.getByRole("button", { name: /删除所选/ }).click();
      await expect(page.getByText("删除所选的 2 位客户？")).toBeVisible();
      await page.getByRole("button", { name: "确认删除" }).click();
    });

    await step("只剩周二，进度统计同步", async () => {
      await expect(page.getByText("完成进度 0 / 1")).toBeVisible();
      await expect(page.getByText("周二")).toBeVisible();
      await expect(page.getByText("周一")).not.toBeVisible();
    });
  },
);

import { scenario, step, expect } from "kliv-scenario";

// 用户要求：今天不想去的客户按「隐藏此客户」，从任务/路线里消失，之后可再恢复
scenario(
  "隐藏今天不想去的客户并可恢复",
  {
    setup: {
      database: [
        {
          table: "customers",
          rows: [
            {
              name: "张三",
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
              zone_id: null,
              completed_at: null,
              collected_amount: null,
              archived: 0,
            },
            {
              name: "李四",
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
    await step("任务页显示两位待收客户", async () => {
      await page.goto("/tasks");
      await expect(page.getByText("张三")).toBeVisible();
      await expect(page.getByText("李四")).toBeVisible();
    });

    await step("隐藏张三后进入已隐藏名单", async () => {
      await page.getByRole("button", { name: "隐藏此客户" }).first().click();
      await expect(page.getByText("已隐藏 1 位客户（今天不去）")).toBeVisible();
    });

    await step("路线页也不再显示张三", async () => {
      await page.goto("/route");
      await expect(page.getByText("李四")).toBeVisible();
      await expect(page.getByText("张三")).not.toBeVisible();
    });

    await step("任务页一键恢复张三", async () => {
      await page.goto("/tasks");
      await page.getByRole("button", { name: "恢复显示" }).click();
      await expect(page.getByText("已隐藏 1 位客户（今天不去）")).not.toBeVisible();
      await expect(page.getByText("张三")).toBeVisible();
    });
  },
);

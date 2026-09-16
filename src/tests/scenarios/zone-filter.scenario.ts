import { scenario, step, expect } from "kliv-scenario";

scenario(
  "收账员选择今天专收某个区",
  {
    setup: {
      database: [
        {
          table: "zones",
          rows: [
            { name: "东区", address: "Taman Molek, Johor Bahru", lat: 1.5285, lng: 103.7908 },
            { name: "南区", address: "Permas Jaya, Johor Bahru", lat: 1.4959, lng: 103.8164 },
          ],
        },
        {
          table: "customers",
          rows: [
            {
              name: "陈东",
              phone: null,
              address: "Jalan Molek 1, Johor Bahru",
              amount: 500,
              priority: 2,
              lat: 1.522,
              lng: 103.788,
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
              name: "林南",
              phone: null,
              address: "Persiaran Permas 3, Johor Bahru",
              amount: 300,
              priority: 2,
              lat: 1.49,
              lng: 103.815,
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
            {
              name: "王北",
              phone: null,
              address: "Jalan Skudai",
              amount: 800,
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
    await step("任务页显示全部客户和地区筛选", async () => {
      await page.goto("/tasks");
      await expect(page.getByText("陈东")).toBeVisible();
      await expect(page.getByText("林南")).toBeVisible();
      await expect(page.getByText("全部地区")).toBeVisible();
      await expect(page.getByRole("button", { name: "东区" })).toBeVisible();
    });

    await step("选择东区后只显示东区客户", async () => {
      await page.getByRole("button", { name: "东区" }).click();
      await expect(page.getByText("陈东")).toBeVisible();
      await expect(page.getByText("林南")).not.toBeVisible();
      await expect(page.getByText("王北")).not.toBeVisible();
    });

    await step("选择南区后只显示南区客户", async () => {
      await page.getByRole("button", { name: "南区" }).click();
      await expect(page.getByText("林南")).toBeVisible();
      await expect(page.getByText("陈东")).not.toBeVisible();
    });

    await step("切回全部地区显示所有客户", async () => {
      await page.getByText("全部地区").click();
      await expect(page.getByText("陈东")).toBeVisible();
      await expect(page.getByText("林南")).toBeVisible();
      await expect(page.getByText("王北")).toBeVisible();
    });

    await step("客户卡显示所属区", async () => {
      await expect(page.getByText("东区", { exact: true }).first()).toBeVisible();
    });
  },
);

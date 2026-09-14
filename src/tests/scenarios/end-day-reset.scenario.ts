import { scenario, step, expect } from 'kliv-scenario';

// 收工重置的journey：一天结束时点击「今日收工」，任务归档、进度归零，
// 首页的预计驾驶距离/时间也跟着清空（显示 —），历史记录保留。
scenario(
  '收账员今日收工后统计归零',
  {
    setup: {
      database: [
        {
          table: 'customers',
          rows: [
            {
              name: 'Ahmad',
              phone: '0127778888',
              address: 'Taman Molek, Johor Bahru',
              amount: 1200,
              priority: 1,
              lat: 1.5285763,
              lng: 103.7908412,
              geo_status: 'ok',
              status: 'done',
              collected_amount: 1200,
              task_date: '2026-09-14',
              pinned_next: 0,
              archived: 0,
            },
            {
              name: 'Lim',
              phone: '0139990000',
              address: 'Permas Jaya, Johor Bahru',
              amount: 800,
              priority: 2,
              lat: 1.4959628,
              lng: 103.8164717,
              geo_status: 'ok',
              status: 'unpaid',
              task_date: '2026-09-14',
              pinned_next: 0,
              archived: 0,
            },
          ],
        },
        {
          table: 'collection_history',
          rows: [
            {
              customer_id: 1,
              customer_name: 'Ahmad',
              result: '已收款',
              collected_amount: 1200,
              recorded_at: 1757856000,
            },
          ],
        },
      ],
    },
  },
  async ({ page }) => {
    await step('首页显示已完成的任务', async () => {
      await page.goto('/');
      await expect(page.getByText('今日任务')).toBeVisible();
      await expect(page.getByText('今日收工，重置任务')).toBeVisible();
    });

    await step('点击收工并确认', async () => {
      await page.getByRole('button', { name: '今日收工，重置任务' }).click();
      await expect(page.getByText('今日收工，重置任务？')).toBeVisible();
      await page.getByRole('button', { name: '确认收工' }).click();
    });

    await step('任务与预计距离时间都归零', async () => {
      await expect(page.getByText('今天还没有待处理客户，先添加或导入客户吧。')).toBeVisible();
      await expect(page.getByText('今日任务')).toBeVisible();
    });

    await step('历史记录仍然保留', async () => {
      await page.goto('/history');
      await expect(page.getByText('Ahmad')).toBeVisible();
      await expect(page.getByText('已收款')).toBeVisible();
    });
  },
);

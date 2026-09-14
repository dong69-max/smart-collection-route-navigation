import { scenario, step, expect } from 'kliv-scenario';

// 收账员的主要journey：看到今日客户 → 打开路线 → 完成任务 → 任务从待处理移除并留下历史记录。
scenario(
  '收账员完成一位客户并留下记录',
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
              status: 'pending',
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
              status: 'pending',
              task_date: '2026-09-14',
              pinned_next: 0,
              archived: 0,
            },
          ],
        },
      ],
    },
  },
  async ({ page }) => {
    await step('首页显示今日任务数量', async () => {
      await page.goto('/');
      await expect(page.getByText('今日任务')).toBeVisible();
      await expect(page.getByText('Ahmad')).toBeVisible();
    });

    await step('任务页可以看到两位客户', async () => {
      await page.goto('/tasks');
      await expect(page.getByText('Ahmad')).toBeVisible();
      await expect(page.getByText('Lim')).toBeVisible();
    });

    await step('搜索可以按姓名筛选', async () => {
      await page.getByPlaceholder('搜索姓名').fill('Lim');
      await expect(page.getByText('Lim')).toBeVisible();
    });

    await step('填写收账结果并完成任务', async () => {
      await page.getByPlaceholder('搜索姓名').fill('Ahmad');
      await page.getByRole('button', { name: '完成任务' }).first().click();
      await expect(page.getByText('收账结果')).toBeVisible();
      await page.getByRole('button', { name: '确认完成' }).click();
    });

    await step('历史记录保存了这次收账', async () => {
      await page.goto('/history');
      await expect(page.getByText('Ahmad')).toBeVisible();
      await expect(page.getByText('已收款')).toBeVisible();
    });
  },
);

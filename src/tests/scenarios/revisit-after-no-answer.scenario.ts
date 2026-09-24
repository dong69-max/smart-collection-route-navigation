import { scenario, step, expect } from 'kliv-scenario';

// 家里没人的情况：完成任务时选「找不到人」→ 自动勾上「需要再次回访」→
// 确认后客户回到待收清单（下次继续去），历史里留下这趟的记录。
scenario(
  '家里没人，记录后客户回到待收清单',
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
              task_date: '2026-09-22',
              pinned_next: 0,
              archived: 0,
              hidden: 0,
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
              task_date: '2026-09-22',
              pinned_next: 0,
              archived: 0,
              hidden: 0,
            },
          ],
        },
      ],
    },
  },
  async ({ page }) => {
    await step('任务清单里能看到 Ahmad 和 Lim', async () => {
      await page.goto('/route');
      await expect(page.getByText('Ahmad').first()).toBeVisible();
      await expect(page.getByText('Lim').first()).toBeVisible();
    });

    await step('打开 Ahmad 的完成任务弹窗', async () => {
      await page.getByRole('button', { name: '完成任务' }).first().click();
      await expect(page.getByText('收账结果')).toBeVisible();
    });

    await step('选「找不到人」，回访自动勾上', async () => {
      await page.getByText('找不到人').click();
      await expect(page.getByText('🔁 需要再次回访')).toBeVisible();
    });

    await step('确认完成，回到待收清单', async () => {
      await page.getByRole('button', { name: '确认完成' }).click();
      await expect(page.getByText('已记录 · 待回访 🔁')).toBeVisible();
      await page.getByRole('button', { name: '完成', exact: true }).click();
    });

    await step('Ahmad 仍在待收清单，历史里有这趟记录', async () => {
      await expect(page.getByText('Ahmad').first()).toBeVisible();
      await page.goto('/history');
      await expect(page.getByText('Ahmad').first()).toBeVisible();
      await expect(page.getByText('找不到人（需再次回访）').first()).toBeVisible();
    });
  },
);

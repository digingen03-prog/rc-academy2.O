import { PrismaClient } from '@prisma/client';
import { FinanceAnalyticsService } from '../src/modules/finance-analytics/finance-analytics.service';
import { SalaryService } from '../src/modules/salary/salary.service';

const prisma = new PrismaClient();

async function main() {
  console.log('--- TESTING MONTH FILTER & TRANSACTIONS REPORT ---');

  const analyticsService = new FinanceAnalyticsService(prisma as any);
  const salaryService = new SalaryService(prisma as any);

  // 1. Test getFinanceExecutiveAnalytics with month filter
  console.log('\nStep 1: Testing getFinanceExecutiveAnalytics with month filter:');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const currentMonthRes = await salaryService.getFinanceExecutiveAnalytics(currentMonth);
  console.log(`- Month: ${currentMonthRes.selectedMonth}`);
  console.log(`- Total Collected: ₹${currentMonthRes.kpis.totalCollected}`);
  console.log(`- Net Academy Profit: ₹${currentMonthRes.kpis.netAcademyProfit}`);
  console.log(`- Approved Expenses: ₹${currentMonthRes.kpis.approvedExpensesAmount}`);

  const allTimeRes = await salaryService.getFinanceExecutiveAnalytics('ALL');
  console.log(`\n- All-time Selected Month: ${allTimeRes.selectedMonth}`);
  console.log(`- All-time Total Collected: ₹${allTimeRes.kpis.totalCollected}`);

  // 2. Test getTransactionsReport
  console.log('\nStep 2: Testing getTransactionsReport:');
  const reportRes = await analyticsService.getTransactionsReport({
    month: currentMonth,
    page: 1,
    limit: 10,
  });

  console.log(`- Report Window: ${reportRes.selectedMonth}`);
  console.log(`- Total Transactions: ${reportRes.summary.totalTransactionsCount}`);
  console.log(`- Total Received (Fees): ₹${reportRes.summary.totalReceived} (${reportRes.summary.receivedCount} txs)`);
  console.log(`- Total Settled (Staff): ₹${reportRes.summary.totalSettled} (${reportRes.summary.settledCount} txs)`);
  console.log(`- Total Expenses (Approved): ₹${reportRes.summary.totalExpenses} (${reportRes.summary.expensesCount} txs)`);
  console.log(`- Total Reversals: ₹${reportRes.summary.totalReversals} (${reportRes.summary.reversalsCount} txs)`);
  console.log(`- Net Cash Flow: ₹${reportRes.summary.netCashFlow}`);
  console.log(`- Paginated items returned: ${reportRes.items.length}`);

  if (reportRes.items.length > 0) {
    const sample = reportRes.items[0];
    console.log(`\nSample Transaction:`);
    console.log(`- Ref: ${sample.reference}`);
    console.log(`- Type: ${sample.type} (${sample.typeLabel})`);
    console.log(`- Flow: ${sample.flow} (₹${sample.amount})`);
    console.log(`- Party: ${sample.party}`);
    console.log(`- Method: ${sample.paymentMethod}`);
  }

  console.log('\n======================================================');
  console.log('TEST COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
}

main()
  .catch((e) => {
    console.error('Error during test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


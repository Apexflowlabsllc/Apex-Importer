import { useAppContext } from "@/context/AppContext";
import {
  Card,
  BlockStack,
  Text,
  InlineStack,
  Badge,
  ProgressBar,
  Box,
  Icon,
  DataTable,
  Link,
  Tooltip,
  Pagination,
} from "@shopify/polaris";

import {
  CheckCircleIcon,
  AlertCircleIcon,
  QuestionCircleIcon,

} from "@shopify/polaris-icons";
import { useMemo, useState } from "react";

const LastJobContent = ({ job, settings, imports }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  const {
    status,
    total,
    processed,
    succeeded,
    failed,
    createdAt,
    // imports,
    error
  } = job;

  const progress = total > 0 ? (processed / total) * 100 : 0;
  const isRunning = status === 'RUNNING' || status === 'QUEUED';

  const statusBadge = useMemo(() => {
    switch (status) {
      case 'COMPLETED':
        return <Badge tone="success">Completed</Badge>;
      case 'RUNNING':
        return <Badge tone="attention" progress="incomplete">Running</Badge>;
      case 'QUEUED':
        return <Badge tone="info" progress="incomplete">Queued</Badge>;
      case 'FAILED':
        return <Badge tone="critical">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  }, [status]);

  const allRows = useMemo(() => {
    if (!imports || imports.length === 0) return [];
    return imports.map(imp => {
      const statusIcon =
        imp.status === 'SUCCESS' ? (
          <Icon source={CheckCircleIcon} tone="success" />
        ) : (
          <Tooltip content={imp.error || 'Failed'} preferredPosition="above">
            <Icon source={AlertCircleIcon} tone="critical" />
          </Tooltip>
        );

      const productLink =
        imp.shopifyProductId && settings?.domain ? (
          <Link
            url={`https://${settings.domain}/admin/products/${imp.shopifyProductId}`}
            target="_blank"
            removeUnderline
          >
            {imp.title}
          </Link>
        ) : (
          imp.title
        );

      return [
        statusIcon,
        productLink,
        imp.sku,
        new Date(imp.createdAt).toLocaleTimeString(),
      ];
    });
  }, [imports, settings?.domain, job.Id]);

  const paginatedRows = allRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingMd">
            {isRunning ? 'Current Import Job' : 'Last Import Job'}
          </Text>
          {statusBadge}
        </InlineStack>

        <BlockStack gap="200">
          <Text>
            Job started at {new Date(createdAt).toLocaleString()}
          </Text>
          {isRunning ? (
            <>
              <ProgressBar progress={progress} tone="highlight" />
              <InlineStack align="space-between">
                <Text tone="subdued">{processed} of {total} items processed</Text>
                <InlineStack gap="400">
                  <Text tone="success">{succeeded} succeeded</Text>
                  <Text tone="critical">{failed} failed</Text>
                </InlineStack>
              </InlineStack>
            </>
          ) : (
            <InlineStack gap="400">
              <Text tone="success">{succeeded} succeeded</Text>
              <Text tone="critical">{failed} failed</Text>
              <Text tone="subdued">{total} total</Text>
            </InlineStack>
          )}

          {status === 'FAILED' && error && (
            <Box paddingTop="200">
              <Text tone="critical">
                <strong>Error:</strong> {error}
              </Text>
            </Box>
          )}
        </BlockStack>
        {allRows.length > 0 && (
          <>
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text']}
              headings={[
                <Box key="status-header" width="20px">
                  <Tooltip content="Status">
                    <Icon source={QuestionCircleIcon} tone="subdued" />
                  </Tooltip>
                </Box>,
                'Product Title',
                'SKU',
                'Time',
              ]}
              rows={paginatedRows}
              verticalAlign="middle"
            />
            {allRows.length > rowsPerPage && (
              <Box paddingBlockStart="400">
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={currentPage > 1}
                    onPrevious={() => setCurrentPage(currentPage - 1)}
                    hasNext={allRows.length > currentPage * rowsPerPage}
                    onNext={() => setCurrentPage(currentPage + 1)}
                  />
                </InlineStack>
              </Box>
            )}
          </>
        )}
      </BlockStack>
    </Card>
  );
};

const LastJob = () => {
  const { lastJob, pending, settings, imports } = useAppContext();
  const jobToDisplay = pending || lastJob;

  return jobToDisplay ? (
    <LastJobContent job={jobToDisplay} settings={settings} imports={imports}/>
  ) : (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd">Last Import Job</Text>
        <Text tone="subdued">No import jobs have been run yet.</Text>
      </BlockStack>
    </Card>
  );
};

export default LastJob;

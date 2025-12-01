import {
  Badge,
  Link,
  Grid,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { useAppContext } from "@/context/AppContext";

export default function QuickStats() {
  const {
    settings,
    totalProducts,
    lastSyncDate,
    userPlanKey,
    userPlan,
  } = useAppContext()

  return (
    <Grid.Cell columnSpan={{ xs: 6, md: 6, lg: 4 }}>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">Quick Stats</Text>

            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text tone="subdued">eBay Store</Text>
                <Badge>{settings?.ebaySellerUsername}</Badge>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between">
                <Text tone="subdued">Total eBay Items</Text>
                <Text fontWeight="semibold">{totalProducts.toLocaleString()}</Text>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between">
                <Text tone="subdued">Last Sync</Text>
                <Text fontWeight="semibold">{lastSyncDate}</Text>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between">
                <Text tone="subdued">Current Plan</Text>
                <Link url="/settings#billing" removeUnderline>
                  <Badge tone={userPlanKey === 'FREE' ? 'info' : 'success'}>
                    {userPlan.name}
                  </Badge>
                </Link>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* {userPlanKey === 'FREE' && (
                  <Card background="bg-surface-success-secondary">
                    <BlockStack gap="300">
                      <InlineStack gap="200">
                        <Icon source={ArrowUpIcon} tone="success" />
                        <Text variant="headingMd">Upgrade Your Plan</Text>
                      </InlineStack>
                      <Text tone="subdued">
                        Unlock unlimited syncs and premium features.
                      </Text>
                      <Button url="/settings#billing" variant="primary" fullWidth>
                        View Plans
                      </Button>
                    </BlockStack>
                  </Card>
                )} */}
      </BlockStack>
    </Grid.Cell>
  );
}

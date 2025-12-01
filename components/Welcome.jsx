import { useAppContext } from "@/context/AppContext";
import { Card, BlockStack, InlineStack, Text, Box, Badge, Button } from "@shopify/polaris";
import { useState } from "react";

export default function Welcome() {
  const { settings, userPlan, userPlanKey, authedFetch, showToast, showModal, hideModal, confirm } = useAppContext();
  const [isUpgrading, setIsUpgrading] = useState(false);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" wrap={false} blockAlign="start">
          <BlockStack gap="200">
            <Text as="h1" variant="headingXl">
              Welcome back, {settings.domain}! 👋
            </Text>

          </BlockStack>

          <Box minWidth="120px" style={{ textAlign: 'right' }}>
            <BlockStack gap="300">


              <Button onClick={() => showToast("sweet success.", { error: false })}>Show Toast</Button>

              <Button onClick={confirm}>Show Modal</Button>
              {/* --- End of new code --- */}

            </BlockStack>
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
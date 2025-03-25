const fetch = require("node-fetch");

const fetchPlans = async () => {
    try {
        console.log("📢 DEBUG: Fetching Square Subscription Plans...");
        const response = await fetch("https://connect.squareup.com/v2/catalog/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN_PRODUCTION}`
            },
            body: JSON.stringify({
                object_types: ["ITEM", "SUBSCRIPTION_PLAN"]
            })
        });

        const data = await response.json();
        console.log("📢 DEBUG: Square API Raw Response:", JSON.stringify(data, null, 2));

        if (data.errors) {
            console.error("❌ ERROR: Failed to fetch Square catalog:", data.errors);
            return { success: false, error: data.errors };
        }

        // ✅ 서비스(ITEM) 필터링 및 가격 정보 추출
        const items = data.objects
            .filter(item => item.type === "ITEM" && item.is_deleted === false)
            .map(item => ({
                id: item.id,
                name: item.item_data.name,
                description: item.item_data.description || "No description available",
                variations: item.item_data.variations.map(variation => ({
                    id: variation.id,
                    name: variation.item_variation_data.name,
                    price: variation.item_variation_data.price_money?.amount || 0,
                    currency: variation.item_variation_data.price_money?.currency || "USD",
                    subscription_plan_ids: variation.item_variation_data.subscription_plan_ids || []
                }))
            }));

        // ✅ 활성화된 구독 플랜(SUBSCRIPTION_PLAN) 필터링
        const plans = data.objects
            .filter(plan =>
                plan.type === "SUBSCRIPTION_PLAN" &&
                plan.is_deleted === false &&
                plan.present_at_all_locations === true
            )
            .map(plan => ({
                id: plan.id,
                name: plan.subscription_plan_data?.name || "Unnamed Plan",
                variations: (plan.subscription_plan_data.subscription_plan_variations || [])
                    .filter(variation => 
                        variation.is_deleted === false &&
                        variation.present_at_all_locations === true
                    )
                    .map(variation => ({
                        id: variation.id,
                        name: variation.subscription_plan_variation_data?.name || "Unnamed Variation",
                        price: variation.subscription_plan_variation_data?.phases?.[0]?.pricing?.price_money?.amount || 0,
                        currency: variation.subscription_plan_variation_data?.phases?.[0]?.pricing?.price_money?.currency || "USD"
                    }))
            }))
            .filter(plan => plan.variations.length > 0); // ✅ 변형이 없는 플랜(비활성화된 플랜)은 제거

        console.log("✅ DEBUG: Fetched Items and Plans:", { items, plans });

        return { items, plans };
    } catch (error) {
        console.error("❌ ERROR fetching Square plans:", error);
        return { success: false, message: "Failed to fetch Square plans" };
    }
};

module.exports = fetchPlans;

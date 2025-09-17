import { NextRequest, NextResponse } from "next/server";
import { cacheManager } from "@/lib/cacheManager";

export async function GET(request: NextRequest) {
  try {
    const cacheStats = cacheManager.getStats();
    
    return NextResponse.json({
      success: true,
      stats: {
        cache: {
          totalItems: cacheStats.totalItems,
          totalSize: cacheStats.totalSize,
          hitRate: cacheStats.hitRate,
          missRate: cacheStats.missRate,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          sizeReadable: `${(cacheStats.totalSize / 1024 / 1024).toFixed(2)}MB`,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to get performance stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get performance stats" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    cacheManager.clear();
    
    return NextResponse.json({
      success: true,
      message: "Cache cleared successfully",
    });
  } catch (error) {
    console.error("Failed to clear cache:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}

package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Represents an item in the moderation queue, fetched from the admin-moderation endpoint. */
@Serializable
data class AdminQueueItem(
    val id: String,
    val url: String,
    val title: String? = null,
    val description: String? = null,
    val status: String? = null, // "pending", "approved", "rejected"
    @SerialName("safe_browsing_passed")
    val safeBrowsingPassed: Boolean? = null,
    @SerialName("submitted_by")
    val submittedBy: String? = null,
    @SerialName("submitted_by_username")
    val submittedByUsername: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("updated_at")
    val updatedAt: String? = null,
    @SerialName("reviewer_note")
    val reviewerNote: String? = null,
    @SerialName("reviewed_by")
    val reviewedBy: String? = null,
    @SerialName("category_id")
    val categoryId: String? = null,
    @SerialName("subcategory_id")
    val subcategoryId: String? = null,
    @SerialName("subcategory_name")
    val subcategoryName: String? = null,
)

/** Represents a dead link report, fetched from the admin-reports endpoint. */
@Serializable
data class AdminReportItem(
    @SerialName("url_id")
    val urlId: String,
    val url: String,
    val title: String? = null,
    @SerialName("report_count")
    val reportCount: Int = 0,
    val inactive: Boolean = false,
    @SerialName("reported_at")
    val reportedAt: String? = null,
)

/** Represents a beta signup entry. */
@Serializable
data class AdminBetaSignup(
    val id: Int,
    val email: String,
    @SerialName("created_at")
    val createdAt: String? = null,
)

/** Aggregate stats for the admin dashboard overview. */
@Serializable
data class AdminStats(
    val pending: Int = 0,
    val approved: Int = 0,
    val rejected: Int = 0,
    val reports: Int = 0,
    val users: Int = 0,
)

/** Response wrapper for the admin-moderation approve/reject endpoint. */
@Serializable
data class AdminActionResponse(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)
package app.roam.android.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.roam.android.viewmodel.MainViewModel
import androidx.compose.ui.graphics.Color

/**
 * Dedicated admin/moderator panel screen.
 * Replaces the inline admin links previously buried in ConfigBottomSheet.
 *
 * Roles:
 *  - Admin: full access (stats, moderation queue, reports, beta, email)
 *  - Moderator: moderation queue + reports only
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(
    vm: MainViewModel,
    isAdmin: Boolean = true,
    onNavigateToRoam: () -> Unit = {},
    onNavigateToWeb: (String) -> Unit = {},
    onOpenInBrowser: (String) -> Unit = {},
) {
    val adminQueue by vm.adminQueue.collectAsState()
    val adminQueueLoading by vm.adminQueueLoading.collectAsState()
    val adminReports by vm.adminReports.collectAsState()
    val adminReportsLoading by vm.adminReportsLoading.collectAsState()
    val adminBetaSignups by vm.adminBetaSignups.collectAsState()
    val adminBetaLoading by vm.adminBetaLoading.collectAsState()
    val adminStats by vm.adminStats.collectAsState()
    val adminActionLoading by vm.adminActionLoading.collectAsState()

    var selectedTab by remember { mutableStateOf("queue") }
    var confirmDialog by remember { mutableStateOf<Pair<String, String>?>(null) } // action, itemId
    var selectedItemDetail by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) {
        vm.loadAdminQueue()
        vm.loadAdminStats()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (isAdmin) "Admin Panel" else "Moderator Panel")
                        Spacer(Modifier.width(8.dp))
                        val roleColor = if (isAdmin) Color(0xFFDC2626) else Color(0xFF2563EB)
                        Text(
                            text = if (isAdmin) "Admin" else "Mod",
                            style = MaterialTheme.typography.labelSmall,
                            color = roleColor,
                            modifier = Modifier
                                .background(roleColor.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateToRoam) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding(),
        ) {
            // ── Stats Cards ──────────────────────────────────────────────
            SectionHeader("Overview")
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StatChip("Pending", "${adminStats?.pending ?: 0}", Color(0xFFF59E0B))
                StatChip("Approved", "${adminStats?.approved ?: 0}", Color(0xFF10B981))
                StatChip("Rejected", "${adminStats?.rejected ?: 0}", Color(0xFFEF4444))
                if (isAdmin) StatChip("Reports", "${adminStats?.reports ?: 0}", Color(0xFF8B5CF6))
            }

            Spacer(Modifier.height(12.dp))

            // ── Tab Bar ──────────────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AdminTab("Queue", "queue", selectedTab) { selectedTab = it }
                AdminTab("Reports", "reports", selectedTab) { selectedTab = it; vm.loadAdminReports() }
                if (isAdmin) {
                    AdminTab("Beta", "beta", selectedTab) { selectedTab = it; vm.loadAdminBetaSignups() }
                    AdminTab("System", "system", selectedTab) { selectedTab = it }
                }
            }

            Spacer(Modifier.height(8.dp))
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            // ── Tab Content ──────────────────────────────────────────────
            when (selectedTab) {
                "queue" -> QueueTab(
                    items = adminQueue,
                    loading = adminQueueLoading,
                    actionLoading = adminActionLoading,
                    isAdmin = isAdmin,
                    onApprove = { id ->
                        confirmDialog = "approve" to id
                    },
                    onReject = { id ->
                        confirmDialog = "reject" to id
                    },
                    onRefresh = { vm.loadAdminQueue() },
                )
                "reports" -> ReportsTab(
                    reports = adminReports,
                    loading = adminReportsLoading,
                    actionLoading = adminActionLoading,
                    isAdmin = isAdmin,
                    onRestore = { id -> vm.restoreReportedLink(id) },
                    onRefresh = { vm.loadAdminReports() },
                )
                "beta" -> BetaTab(
                    signups = adminBetaSignups,
                    loading = adminBetaLoading,
                    onDelete = { id -> vm.deleteBetaSignup(id) },
                    onRefresh = { vm.loadAdminBetaSignups() },
                )
                "system" -> SystemTab(
                    onOpenWebAdmin = { onOpenInBrowser("https://roamtheweb.app/admin") },
                    onOpenWebQueue = { onOpenInBrowser("https://roamtheweb.app/admin?view=queue") },
                    onOpenWebAnalytics = { onOpenInBrowser("https://roamtheweb.app/admin?view=analytics") },
                    onOpenWebBadges = { onOpenInBrowser("https://roamtheweb.app/admin?view=badges") },
                    onOpenWebEmail = { onOpenInBrowser("https://roamtheweb.app/admin?view=email") },
                )
            }

            Spacer(Modifier.height(32.dp))
        }
    }

    // ── Confirmation dialog ────────────────────────────────────────────────
    if (confirmDialog != null) {
        val (action, itemId) = confirmDialog!!
        AlertDialog(
            onDismissRequest = { confirmDialog = null },
            title = { Text(if (action == "approve") "Approve submission?" else "Reject submission?") },
            text = {
                Text(
                    if (action == "approve")
                        "This URL will be added to the Roam pool."
                    else
                        "This URL will be removed from the queue."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (action == "approve") vm.approveSubmission(itemId)
                        else vm.rejectSubmission(itemId)
                        confirmDialog = null
                    },
                ) {
                    Text(if (action == "approve") "Approve" else "Reject", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDialog = null }) { Text("Cancel") }
            },
        )
    }
}

// ── Reusable Components ───────────────────────────────────────────────────────

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
private fun RowScope.StatChip(label: String, value: String, color: Color) {
    Card(
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.08f)),
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
        }
    }
}

@Composable
private fun AdminTab(label: String, id: String, selected: String, onSelect: (String) -> Unit) {
    TextButton(
        onClick = { onSelect(id) },
        modifier = Modifier.padding(vertical = 0.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (selected == id) FontWeight.Bold else FontWeight.Normal,
            color = if (selected == id) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
        )
    }
}

// ── Queue Tab ─────────────────────────────────────────────────────────────────

@Composable
private fun QueueTab(
    items: List<app.roam.android.model.AdminQueueItem>,
    loading: Boolean,
    actionLoading: Boolean,
    isAdmin: Boolean,
    onApprove: (String) -> Unit,
    onReject: (String) -> Unit,
    onRefresh: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Moderation Queue", style = MaterialTheme.typography.titleSmall)
            TextButton(onClick = onRefresh) { Text("Refresh") }
        }

        Spacer(Modifier.height(8.dp))

        if (loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(32.dp), strokeWidth = 2.dp)
            }
        } else if (items.isEmpty()) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("All caught up! \uD83C\uDF89", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }
        } else {
            items.forEach { item ->
                QueueItemCard(
                    item = item,
                    isAdmin = isAdmin,
                    actionLoading = actionLoading,
                    onApprove = { onApprove(item.id) },
                    onReject = { onReject(item.id) },
                )
            }
        }
    }
}

@Composable
private fun QueueItemCard(
    item: app.roam.android.model.AdminQueueItem,
    isAdmin: Boolean,
    actionLoading: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = when (item.status) {
                "approved" -> Color(0xFF10B981).copy(alpha = 0.06f)
                "rejected" -> Color(0xFFEF4444).copy(alpha = 0.06f)
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
        ),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        item.title ?: item.url,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        item.url,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    item.status ?: "unknown",
                    style = MaterialTheme.typography.labelSmall,
                    color = when (item.status) {
                        "approved" -> Color(0xFF10B981)
                        "rejected" -> Color(0xFFEF4444)
                        else -> Color(0xFFF59E0B)
                    },
                    modifier = Modifier
                        .background(
                            when (item.status) {
                                "approved" -> Color(0xFF10B981).copy(alpha = 0.12f)
                                "rejected" -> Color(0xFFEF4444).copy(alpha = 0.12f)
                                else -> Color(0xFFF59E0B).copy(alpha = 0.12f)
                            },
                            RoundedCornerShape(4.dp),
                        )
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }

            if (item.submittedByUsername != null || item.createdAt != null || item.subcategoryName != null) {
                Spacer(Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (item.submittedByUsername != null) {
                        Text(
                            "@${item.submittedByUsername}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        )
                    }
                    if (item.createdAt != null) {
                        Text(
                            item.createdAt,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                        )
                    }
                }
                if (item.subcategoryName != null) {
                    Text(
                        "Topic: ${item.subcategoryName}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
                    )
                }
            }

            // Action buttons for pending items
            if (item.status == "pending") {
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(
                        onClick = onReject,
                        enabled = !actionLoading,
                    ) {
                        Text("Reject", color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.width(8.dp))
                    TextButton(onClick = onApprove, enabled = !actionLoading) {
                        Text("Approve", color = Color(0xFF10B981))
                    }
                }
            }
        }
    }
}

// ── Reports Tab ───────────────────────────────────────────────────────────────

@Composable
private fun ReportsTab(
    reports: List<app.roam.android.model.AdminReportItem>,
    loading: Boolean,
    actionLoading: Boolean,
    isAdmin: Boolean,
    onRestore: (String) -> Unit,
    onRefresh: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Dead Link Reports", style = MaterialTheme.typography.titleSmall)
            TextButton(onClick = onRefresh) { Text("Refresh") }
        }

        Spacer(Modifier.height(8.dp))

        if (loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(32.dp), strokeWidth = 2.dp)
            }
        } else if (reports.isEmpty()) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("No dead link reports", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }
        } else {
            reports.forEach { report ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            report.url,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        if (report.title != null) {
                            Text(
                                report.title,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    "${report.reportCount} report${if (report.reportCount != 1) "s" else ""}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                                )
                                Text(
                                    if (report.inactive) "Inactive" else "Active",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (report.inactive) Color(0xFFEF4444) else Color(0xFF10B981),
                                )
                            }
                            if (report.inactive) {
                                TextButton(
                                    onClick = { onRestore(report.urlId) },
                                    enabled = !actionLoading,
                                ) {
                                    Text("Restore", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Beta Tab ──────────────────────────────────────────────────────────────────

@Composable
private fun BetaTab(
    signups: List<app.roam.android.model.AdminBetaSignup>,
    loading: Boolean,
    onDelete: (Int) -> Unit,
    onRefresh: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Beta Signups • ${signups.size}",
                style = MaterialTheme.typography.titleSmall,
            )
            TextButton(onClick = onRefresh) { Text("Refresh") }
        }

        Spacer(Modifier.height(8.dp))

        if (loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(32.dp), strokeWidth = 2.dp)
            }
        } else if (signups.isEmpty()) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("No signups yet", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }
        } else {
            signups.forEach { signup ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(signup.email, style = MaterialTheme.typography.bodyMedium)
                        if (signup.createdAt != null) {
                            Text(
                                signup.createdAt,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                            )
                        }
                    }
                    TextButton(onClick = { onDelete(signup.id) }) {
                        Text("Delete", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
                    }
                }
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            }
        }
    }
}

// ── System Tab ────────────────────────────────────────────────────────────────

@Composable
private fun SystemTab(
    onOpenWebAdmin: () -> Unit,
    onOpenWebQueue: () -> Unit,
    onOpenWebAnalytics: () -> Unit,
    onOpenWebBadges: () -> Unit,
    onOpenWebEmail: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionHeader("Web Admin Panels")
        SystemActionRow("Moderation Queue", "Review pending submissions", onClick = onOpenWebQueue)
        SystemActionRow("Analytics", "View usage statistics", onClick = onOpenWebAnalytics)
        SystemActionRow("Badges", "Grant badges to users", onClick = onOpenWebBadges)
        SystemActionRow("Email", "Send bulk emails", onClick = onOpenWebEmail)
        Spacer(Modifier.height(8.dp))
        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
        Spacer(Modifier.height(8.dp))
        SectionHeader("Full Dashboard")
        SystemActionRow("Open Admin Dashboard", "roamtheweb.app/admin", onClick = onOpenWebAdmin)
    }
}

@Composable
private fun SystemActionRow(title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text("↗", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
    }
}
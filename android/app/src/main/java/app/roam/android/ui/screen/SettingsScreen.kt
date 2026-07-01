package app.roam.android.ui.screen

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import app.roam.android.BuildConfig
import app.roam.android.data.supabase
import app.roam.android.model.SubcategoryItem
import app.roam.android.viewmodel.MainViewModel
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Constants to avoid recreating lists on every recomposition
private val AVAILABLE_LANGUAGES = listOf(
    "en" to "English", "fr" to "Français", "de" to "Deutsch",
    "it" to "Italiano", "es" to "Español", "pt" to "Português",
    "nl" to "Nederlands", "pl" to "Polski", "ja" to "日本語",
    "zh" to "中文", "ru" to "Русский", "ko" to "한국어",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    vm: MainViewModel,
    onSignOut: () -> Unit,
    onNavigateToSaved: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToHistory: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToRoam: () -> Unit = {},
    onNavigateToAdmin: () -> Unit = {},
) {
    val skipPaywalled by vm.skipPaywalled.collectAsState()
    val webDarkMode by vm.webDarkMode.collectAsState()
    val preferredLanguages by vm.preferredLanguages.collectAsState()
    val jsEnabled by vm.jsEnabled.collectAsState()
    val prefetchWebView by vm.prefetchWebView.collectAsState()
    val sheetGestureMode by vm.sheetGestureMode.collectAsState()
    val categories by vm.categories.collectAsState()
    val subcategories by vm.subcategories.collectAsState()
    val focusModeEnabled by vm.focusModeEnabled.collectAsState()
    val focusCategoryId by vm.focusCategoryId.collectAsState()
    val focusSubcategoryId by vm.focusSubcategoryId.collectAsState()
    val context = LocalContext.current
    var showSignOutDialog by remember { mutableStateOf(value = false) }
    var showSubmitUrlDialog by remember { mutableStateOf(false) }
    var languageFilterDropdownExpanded by remember { mutableStateOf(false) }
    var focusCategoryDropdownExpanded by remember { mutableStateOf(false) }
    var focusSubcategoryDropdownExpanded by remember { mutableStateOf(false) }
    val appTheme by vm.appTheme.collectAsState()
    val notificationsEnabled by vm.notificationsEnabled.collectAsState()
    val currentUrl by vm.currentUrl.collectAsState()
    val savedConfirmation by vm.savedConfirmation.collectAsState()

    // Admin gate: tap the Version row 5 times within 3 seconds to unlock.
    var versionTapCount by remember { mutableStateOf(0) }
    var versionTapResetJob by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    val scope = rememberCoroutineScope()
    fun onVersionTap() {
        val newCount = versionTapCount + 1
        versionTapCount = newCount
        versionTapResetJob?.cancel()
        versionTapResetJob = scope.launch {
            delay(3000L)
            versionTapCount = 0
        }
        if (newCount >= 5) {
            versionTapCount = 0
            versionTapResetJob?.cancel()
            // Only unlock for the admin user. The admin user ID is compared at runtime
            // against the currently signed-in Supabase user — no other user can enter.
            val currentUserId = runCatching {
                supabase.auth.currentUserOrNull()?.id
            }.getOrNull()
            // Replace "YOUR_ADMIN_USER_UUID" with the admin's Supabase auth user ID string.
            // This UUID identifies you uniquely. It is not a secret — the real security
            // is handled by the web admin panel's service-role-key requirement.
            if (currentUserId == "a559a4be-05c3-46c7-9497-23d49bbeaa5f") {
                vm.setAdminMode(true)
                onNavigateToRoam()
            }
        }
    }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { /* ignored */ },
            title = { Text("Sign out?") },
            text = { Text("You'll need to sign in again to continue using Roam.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showSignOutDialog = false
                        onSignOut()
                    },
                ) {
                    Text("Sign out")
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (showSubmitUrlDialog) {
        SubmitUrlDialog(
            categories = categories,
            subcategories = subcategories,
            onSubmit = { url, categoryId, subcategoryId ->
                vm.submitUrl(url, categoryId, subcategoryId)
                showSubmitUrlDialog = false
            },
            onDismiss = { showSubmitUrlDialog = false },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
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
            SectionHeader("Account")

            SettingsActionRow(
                title = "Profile",
                subtitle = "Edit your name, avatar and categories",
                onClick = onNavigateToProfile,
            )
            SettingsActionRow(title = "Saved pages", subtitle = "Pages you bookmarked", onClick = onNavigateToSaved)
            SettingsActionRow(
                title = "Bookmark this page",
                subtitle = if (savedConfirmation) "Saved!" else currentUrl ?: "No page loaded",
                onClick = { vm.saveForLater() },
            )

            SettingsActionRow(
                title = "Browsing history",
                subtitle = "Pages you've visited",
                onClick = onNavigateToHistory,
            )

            SettingsActionRow(
                title = "Notifications",
                subtitle = "Updates about your activity",
                onClick = onNavigateToNotifications,
            )

            SettingsToggleRow(
                title = "Push notifications",
                subtitle = "Receive notifications about submissions, followers, and activity",
                checked = notificationsEnabled,
                onCheckedChange = { vm.setNotificationsEnabled(it) },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Browser")

            // Language selection for discovery filtering
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Preferred languages", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "Select which languages you want to see",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
                Box {
                    val selectedLabel = if (preferredLanguages.size == AVAILABLE_LANGUAGES.size) {
                        "All"
                    } else if (preferredLanguages.isEmpty()) {
                        "None"
                    } else {
                        "${preferredLanguages.size}"
                    }
                    OutlinedButton(onClick = { languageFilterDropdownExpanded = !languageFilterDropdownExpanded }) {
                        Text(selectedLabel)
                    }
                    DropdownMenu(
                        expanded = languageFilterDropdownExpanded,
                        onDismissRequest = { languageFilterDropdownExpanded = false },
                    ) {
                        // "All languages" option
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val newLangs = if (preferredLanguages.size == AVAILABLE_LANGUAGES.size) {
                                        listOf("en")  // Default to English if already all selected
                                    } else {
                                        AVAILABLE_LANGUAGES.map { it.first }
                                    }
                                    vm.setPreferredLanguages(newLangs)
                                }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(
                                checked = preferredLanguages.size == AVAILABLE_LANGUAGES.size,
                                onCheckedChange = { isChecked ->
                                    val newLangs = if (isChecked) {
                                        AVAILABLE_LANGUAGES.map { it.first }
                                    } else {
                                        listOf("en")
                                    }
                                    vm.setPreferredLanguages(newLangs)
                                },
                            )
                            Text("All languages", modifier = Modifier.padding(start = 8.dp))
                        }

                        HorizontalDivider()

                        AVAILABLE_LANGUAGES.forEach { (code, label) ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        val newLangs = if (preferredLanguages.contains(code)) {
                                            preferredLanguages - code
                                        } else {
                                            preferredLanguages + code
                                        }
                                        vm.setPreferredLanguages(newLangs)
                                    }
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Checkbox(
                                    checked = preferredLanguages.contains(code),
                                    onCheckedChange = { isChecked ->
                                        val newLangs = if (isChecked) {
                                            preferredLanguages + code
                                        } else {
                                            preferredLanguages - code
                                        }
                                        vm.setPreferredLanguages(newLangs)
                                    },
                                )
                                Text(label, modifier = Modifier.padding(start = 8.dp))
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Browser Features")

            SectionHeader("Appearance")

            var themeDropdownExpanded by remember { mutableStateOf(false) }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Theme", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "App color scheme",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
                Box {
                    OutlinedButton(onClick = { themeDropdownExpanded = true }) {
                        Text(
                            when (appTheme) {
                                "dark" -> "Dark"
                                "light" -> "Light"
                                else -> "System"
                            }
                        )
                    }
                    DropdownMenu(
                        expanded = themeDropdownExpanded,
                        onDismissRequest = { themeDropdownExpanded = false },
                    ) {
                        DropdownMenuItem(
                            text = { Text("System") },
                            onClick = {
                                vm.setAppTheme("system")
                                themeDropdownExpanded = false
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Dark") },
                            onClick = {
                                vm.setAppTheme("dark")
                                themeDropdownExpanded = false
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Light") },
                            onClick = {
                                vm.setAppTheme("light")
                                themeDropdownExpanded = false
                            },
                        )
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Browser Features")

            SettingsToggleRow(
                title = "Dark mode",
                subtitle = "Apply dark theme to web pages",
                checked = webDarkMode,
                onCheckedChange = { vm.setWebDarkMode(it) },
            )

            SettingsToggleRow(
                title = "JavaScript",
                subtitle = "Disable to reduce tracking on sites you browse",
                checked = jsEnabled,
                onCheckedChange = { vm.setJsEnabled(it) },
            )

            SettingsToggleRow(
                title = "Preload next page",
                subtitle = "Loads the next URL in the background while you're reading the current one — uses more data",
                checked = prefetchWebView,
                onCheckedChange = { vm.setPrefetchWebView(it) },
            )

            var sheetGestureDropdownExpanded by remember { mutableStateOf(false) }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Menu gesture", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "How to open the menu",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
                Box {
                    OutlinedButton(onClick = { sheetGestureDropdownExpanded = true }) {
                        Text(if (sheetGestureMode == "slide") "Slide up" else "Tap handle")
                    }
                    DropdownMenu(
                        expanded = sheetGestureDropdownExpanded,
                        onDismissRequest = { sheetGestureDropdownExpanded = false },
                    ) {
                        DropdownMenuItem(
                            text = { Text("Slide up") },
                            onClick = {
                                vm.setSheetGestureMode("slide")
                                sheetGestureDropdownExpanded = false
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Tap handle") },
                            onClick = {
                                vm.setSheetGestureMode("tap")
                                sheetGestureDropdownExpanded = false
                            },
                        )
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Delete cookies", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "Clear all cookies and site data",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
                OutlinedButton(onClick = { vm.clearCookies() }) { Text("Clear") }
            }

            SectionHeader("Discovery")

            SettingsToggleRow(
                title = "Focus mode",
                subtitle = "Roam within a specific topic",
                checked = focusModeEnabled,
                onCheckedChange = { vm.setFocusMode(it) },
            )

            if (focusModeEnabled) {
                // Category picker
                val focusCategory = categories.firstOrNull { it.id == focusCategoryId }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Category",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f),
                    )
                    Box {
                        OutlinedButton(onClick = { focusCategoryDropdownExpanded = true }) {
                            Text(focusCategory?.let { "${it.icon} ${it.name}" } ?: "Pick one…")
                        }
                        DropdownMenu(
                            expanded = focusCategoryDropdownExpanded,
                            onDismissRequest = { focusCategoryDropdownExpanded = false },
                        ) {
                            categories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { Text("${cat.icon} ${cat.name}") },
                                    onClick = {
                                        vm.setFocusCategory(cat.id)
                                        focusCategoryDropdownExpanded = false
                                    },
                                )
                            }
                        }
                    }
                }

                // Subcategory picker — only shown once a category is chosen
                if (focusCategoryId != null) {
                    val filteredSubcats = subcategories.filter { it.categoryId == focusCategoryId }
                    val focusSubcat = filteredSubcats.firstOrNull { it.id == focusSubcategoryId }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Topic",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(1f),
                        )
                        Box {
                            OutlinedButton(onClick = { focusSubcategoryDropdownExpanded = true }) {
                                Text(focusSubcat?.name ?: "All")
                            }
                            DropdownMenu(
                                expanded = focusSubcategoryDropdownExpanded,
                                onDismissRequest = { focusSubcategoryDropdownExpanded = false },
                            ) {
                                DropdownMenuItem(
                                    text = { Text("All") },
                                    onClick = {
                                        vm.setFocusSubcategory(null)
                                        focusSubcategoryDropdownExpanded = false
                                    },
                                )
                                filteredSubcats.forEach { sub ->
                                    DropdownMenuItem(
                                        text = { Text(sub.name) },
                                        onClick = {
                                            vm.setFocusSubcategory(sub.id)
                                            focusSubcategoryDropdownExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }

            SettingsToggleRow(
                title = "Skip paywalled sites",
                subtitle = "Hide NYT, WSJ, and similar sites",
                checked = skipPaywalled,
                onCheckedChange = { vm.setSkipPaywalled(it) },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Feedback")

            SettingsActionRow(
                title = "Submit a URL",
                subtitle = "Suggest a page to add to Roam",
                onClick = { showSubmitUrlDialog = true },
            )

            SettingsActionRow(
                title = "Send feedback",
                subtitle = "Tell us what you think",
                onClick = {
                    val intent = Intent(Intent.ACTION_SENDTO).apply {
                        data = "mailto:developer@roamtheweb.app".toUri()
                        putExtra(Intent.EXTRA_SUBJECT, "Roam feedback")
                    }
                    context.startActivity(Intent.createChooser(intent, "Send feedback"))
                },
            )

            SettingsActionRow(
                title = "Rate this app",
                subtitle = "Leave a review on Google Play",
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = "https://play.google.com/store/apps/details?id=app.roam.android".toUri()
                        setPackage("com.android.vending")
                    }
                    runCatching { context.startActivity(intent) }
                        .onFailure {
                            // Fallback: open in browser if Play Store app isn't available
                            val browserIntent = Intent(Intent.ACTION_VIEW).apply {
                                data = "https://play.google.com/store/apps/details?id=app.roam.android".toUri()
                            }
                            context.startActivity(Intent.createChooser(browserIntent, "Rate Roam"))
                        }
                },
            )

            SettingsActionRow(
                title = "Report dead link",
                subtitle = currentUrl ?: "No page loaded",
                onClick = {
                    vm.reportBrokenLink()
                    onNavigateToRoam()
                },
            )

            SettingsActionRow(
                title = "View the tour again",
                subtitle = "Replay the feature walkthrough",
                onClick = {
                    vm.resetWalkthrough()
                    onNavigateToRoam()
                },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Sign out")

            SettingsActionRow(
                title = "Sign out",
                subtitle = null,
                tint = MaterialTheme.colorScheme.error,
                onClick = { showSignOutDialog = true },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("About")

            SettingsActionRow(
                title = "Privacy policy",
                subtitle = null,
                onClick = {
                    CustomTabsIntent.Builder().build()
                        .launchUrl(context, Uri.parse("https://roamtheweb.app/privacy"))
                },
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = { onVersionTap() })
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Version",
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = BuildConfig.VERSION_NAME,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SubmitUrlDialog(
    categories: List<app.roam.android.model.CategoryItem>,
    subcategories: List<SubcategoryItem>,
    onSubmit: (url: String, categoryId: String, subcategoryId: String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var url by remember { mutableStateOf("") }
    var selectedCategoryId by remember { mutableStateOf<String?>(null) }
    var selectedSubcategoryId by remember { mutableStateOf<String?>(null) }
    var categoryDropdownExpanded by remember { mutableStateOf(false) }
    var subcategoryDropdownExpanded by remember { mutableStateOf(false) }

    val selectedCategory = categories.firstOrNull { it.id == selectedCategoryId }
    val filteredSubcats = subcategories.filter { it.categoryId == selectedCategoryId }
    val selectedSubcat = filteredSubcats.firstOrNull { it.id == selectedSubcategoryId }
    val canSubmit = url.isNotBlank() && selectedCategoryId != null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Submit a URL") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("URL") },
                    placeholder = { Text("https://example.com/article") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                // Category picker
                Column {
                    Text(
                        "Category",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                    Spacer(Modifier.height(4.dp))
                    Box {
                        OutlinedButton(
                            onClick = { categoryDropdownExpanded = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                selectedCategory?.let { "${it.icon} ${it.name}" } ?: "Pick a category…",
                                modifier = Modifier.weight(1f),
                            )
                        }
                        DropdownMenu(
                            expanded = categoryDropdownExpanded,
                            onDismissRequest = { categoryDropdownExpanded = false },
                        ) {
                            categories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { Text("${cat.icon} ${cat.name}") },
                                    onClick = {
                                        selectedCategoryId = cat.id
                                        selectedSubcategoryId = null  // reset subcategory on category change
                                        categoryDropdownExpanded = false
                                    },
                                )
                            }
                        }
                    }
                }

                // Subcategory picker — only shown once a category is selected
                if (selectedCategoryId != null && filteredSubcats.isNotEmpty()) {
                    Column {
                        Text(
                            "Topic (optional)",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        )
                        Spacer(Modifier.height(4.dp))
                        Box {
                            OutlinedButton(
                                onClick = { subcategoryDropdownExpanded = true },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    selectedSubcat?.name ?: "Any topic",
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            DropdownMenu(
                                expanded = subcategoryDropdownExpanded,
                                onDismissRequest = { subcategoryDropdownExpanded = false },
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Any topic") },
                                    onClick = {
                                        selectedSubcategoryId = null
                                        subcategoryDropdownExpanded = false
                                    },
                                )
                                filteredSubcats.forEach { sub ->
                                    DropdownMenuItem(
                                        text = { Text(sub.name) },
                                        onClick = {
                                            selectedSubcategoryId = sub.id
                                            subcategoryDropdownExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSubmit(url.trim(), selectedCategoryId!!, selectedSubcategoryId) },
                enabled = canSubmit,
            ) { Text("Submit") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}



@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
    )
}

@Composable
private fun SettingsToggleRow(
    title: String,
    subtitle: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun SettingsActionRow(
    title: String,
    subtitle: String?,
    onClick: () -> Unit,
    tint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = tint, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}



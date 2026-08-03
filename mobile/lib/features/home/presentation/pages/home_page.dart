import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:genmeet/app/config/providers.dart';
import 'package:genmeet/app/router/app_routes.dart';
import 'package:genmeet/app/theme/app_colors.dart';
import 'package:genmeet/core/constants/app_constants.dart';
import 'package:genmeet/core/widgets/app_empty_state.dart';
import 'package:genmeet/core/widgets/app_error_view.dart';
import 'package:genmeet/core/widgets/gm_avatar.dart';
import 'package:genmeet/core/widgets/gm_shimmer.dart';
import 'package:genmeet/features/authentication/application/session_controller.dart';
import 'package:genmeet/features/branding/application/branding_providers.dart';
import 'package:genmeet/features/branding/presentation/widgets/mobile_popup_ad.dart';
import 'package:genmeet/features/contacts/application/contacts_controllers.dart';
import 'package:genmeet/features/meetings/application/meetings_controllers.dart';
import 'package:genmeet/features/meetings/domain/entities/meeting.dart';
import 'package:genmeet/features/notifications/application/notifications_controllers.dart';
import 'package:genmeet/features/profile/application/profile_controllers.dart';
import 'package:genmeet/features/subscription/application/subscription_controllers.dart';
import 'package:genmeet/features/subscription/domain/entities/subscription_info.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// Home dashboard — layout matched to GenMeet commercial light mockup.
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  @override
  void initState() {
    super.initState();
    // Cold start only: in-memory gate ignores pull-to-refresh branding reload.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(maybeShowMobilePopupAd(context, ref));
    });
  }

  Future<void> _refresh() async {
    await Future.wait([
      ref.read(upcomingMeetingsProvider.notifier).refresh(),
      ref.read(previousMeetingsProvider.notifier).refresh(),
      ref.read(quickContactsProvider.notifier).refresh(),
      ref.read(subscriptionProvider.notifier).refresh(),
      ref.read(notificationsProvider.notifier).refresh(),
      ref.refresh(platformBrandingProvider.future),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final profile = ref.watch(profileProvider);
    final sessionUser = ref.watch(sessionControllerProvider).user;
    final name = profile?.name ?? sessionUser?.name ?? 'Pengguna';
    final unread = ref.watch(unreadNotificationsCountProvider).valueOrNull ?? 0;
    final plan = ref.watch(subscriptionProvider).valueOrNull;

    return Scaffold(
      backgroundColor: tokens.background,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFEFF6FF), Color(0xFFF7F9FC), Color(0xFFF7F9FC)],
            stops: [0.0, 0.22, 1.0],
          ),
        ),
        child: SafeArea(
          child: RefreshIndicator(
            color: tokens.primary,
            onRefresh: _refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 16, 0),
                    child: _HomeHeader(
                      name: name,
                      unread: unread,
                      onNotifications: () =>
                          context.push(AppRoutes.notifications),
                      onProfile: () => context.go(AppRoutes.profile),
                    ),
                  ),
                ),
                const SoftiverGap(16),
                const Softiver(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20),
                    child: _HeroCarousel(),
                  ),
                ),
                const SoftiverGap(16),
                const Softiver(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20),
                    child: _QuickActionsGrid(),
                  ),
                ),
                Softiver(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                    child: _SectionTitle(
                      title: 'Meeting Mendatang',
                      onSeeAll: () => context.go(AppRoutes.meetings),
                    ),
                  ),
                ),
                Softiver(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: _UpcomingList(),
                  ),
                ),
                Softiver(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                    child: _SectionTitle(
                      title: 'Riwayat Terbaru',
                      onSeeAll: () => context.go(AppRoutes.meetings),
                    ),
                  ),
                ),
                Softiver(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                    child: _RecentList(),
                  ),
                ),
                Softiver(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                    child: _SectionTitle(
                      title: 'Kontak Cepat',
                      onSeeAll: () => context.go(AppRoutes.contacts),
                    ),
                  ),
                ),
                const Softiver(
                  child: SizedBox(height: 108, child: _QuickContactsRow()),
                ),
                Softiver(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                    child: _PremiumBanner(
                      plan: plan,
                      onTap: () => context.push(AppRoutes.subscription),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Tiny helpers so section widgets stay readable in the sliver list.
class Softiver extends StatelessWidget {
  const Softiver({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => SliverToBoxAdapter(child: child);
}

class SoftiverGap extends StatelessWidget {
  const SoftiverGap(this.height, {super.key});
  final double height;

  @override
  Widget build(BuildContext context) =>
      Softiver(child: SizedBox(height: height));
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.name,
    required this.unread,
    required this.onNotifications,
    required this.onProfile,
  });

  final String name;
  final int unread;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final hour = DateTime.now().hour;
    final greet = hour < 11
        ? 'Selamat pagi'
        : hour < 15
            ? 'Selamat siang'
            : hour < 18
                ? 'Selamat sore'
                : 'Selamat malam';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '$greet, ',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.navy,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                    TextSpan(
                      text: name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.navy,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const TextSpan(text: ' 👋'),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                'Siap untuk rapat hari ini?',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: tokens.textSecondary,
                ),
              ),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Notifikasi',
          onPressed: onNotifications,
          icon: Badge(
            isLabelVisible: unread > 0,
            backgroundColor: const Color(0xFFE53935),
            label: Text('$unread', style: const TextStyle(fontSize: 10)),
            child: Icon(
              Icons.notifications_none_rounded,
              color: AppColors.navy.withValues(alpha: 0.75),
              size: 26,
            ),
          ),
        ),
        const SizedBox(width: 2),
        GestureDetector(
          onTap: onProfile,
          child: Stack(
            children: [
              GmAvatar(name: name, size: 42),
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: const Color(0xFF22C55E),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroCarousel extends ConsumerStatefulWidget {
  const _HeroCarousel();

  @override
  ConsumerState<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends ConsumerState<_HeroCarousel> {
  final _page = PageController();
  int _index = 0;

  static const _fallbackSlides = [
    (
      title: AppConstants.appName,
      body: 'Rapat stabil, aman, dan kolaborasi tanpa batas.',
      imageUrl: null,
    ),
    (
      title: 'Waiting room & host control',
      body: 'Kelola akses peserta dengan aman sebelum masuk ruang.',
      imageUrl: null,
    ),
    (
      title: 'Siap dipakai tim',
      body: 'Jadwalkan, undang, dan mulai meeting dalam hitungan menit.',
      imageUrl: null,
    ),
  ];

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final branding = ref.watch(platformBrandingProvider).valueOrNull;
    final apiBase = ref.watch(appConfigProvider).apiBaseUrl;
    final remote = branding?.mobileBannerSlides ?? const <MobileBannerSlide>[];
    final slides = remote.isNotEmpty
        ? remote
            .map(
              (slide) => (
                title: slide.title.isNotEmpty ? slide.title : AppConstants.appName,
                body: slide.body,
                imageUrl: resolveBrandAssetUrl(apiBase, slide.imageUrl),
              ),
            )
            .toList()
        : _fallbackSlides;

    final safeIndex = _index.clamp(0, slides.length - 1);

    return Column(
      children: [
        SizedBox(
          // Keep mobile banner compact — matches 2.5:1 assets (~1080×432).
          height: 120,
          child: PageView.builder(
            controller: _page,
            itemCount: slides.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) {
              final slide = slides[i];
              final hasImage = slide.imageUrl != null && slide.imageUrl!.isNotEmpty;
              return Container(
                margin: const EdgeInsets.only(right: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: hasImage
                      ? null
                      : const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF2D8CFF), Color(0xFF0B5CFF)],
                        ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.22),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (hasImage)
                      Image.network(
                        slide.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF2D8CFF), Color(0xFF0B5CFF)],
                            ),
                          ),
                        ),
                      ),
                    if (hasImage)
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [
                              Colors.black.withValues(alpha: 0.55),
                              Colors.black.withValues(alpha: 0.15),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    if (!hasImage)
                      Positioned(
                        right: -8,
                        top: 8,
                        bottom: 8,
                        child: Row(
                          children: [
                            Icon(
                              Icons.videocam_rounded,
                              size: 48,
                              color: Colors.white.withValues(alpha: 0.22),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              Icons.verified_user_rounded,
                              size: 40,
                              color: Colors.white.withValues(alpha: 0.28),
                            ),
                            const SizedBox(width: 16),
                          ],
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 72, 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            slide.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                          if (slide.body.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              slide.body,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.92),
                                height: 1.3,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(slides.length, (i) {
            final active = i == safeIndex;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.only(right: 6),
              width: active ? 16 : 7,
              height: 7,
              decoration: BoxDecoration(
                color: active
                    ? AppColors.primary
                    : AppColors.primary.withValues(alpha: 0.28),
                borderRadius: BorderRadius.circular(8),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid();

  @override
  Widget build(BuildContext context) {
    final actions = [
      (
        'Meeting Baru',
        'Mulai rapat instan',
        Icons.videocam_rounded,
        () => context.push(AppRoutes.createMeeting),
      ),
      (
        'Gabung',
        'Gabung ke rapat',
        Icons.add_box_outlined,
        () => context.push(AppRoutes.join),
      ),
      (
        'Jadwalkan',
        'Atur rapat nanti',
        Icons.calendar_month_outlined,
        () => context.push(AppRoutes.scheduleMeeting),
      ),
      (
        'Bagikan Layar',
        'Tampilkan presentasi',
        Icons.screen_share_outlined,
        () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Mulai meeting lalu bagikan layar dari kontrol ruang.',
              ),
            ),
          );
          context.push(AppRoutes.createMeeting);
        },
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 2.15,
      children: [
        for (final a in actions)
          _ActionCard(
            title: a.$1,
            subtitle: a.$2,
            icon: a.$3,
            onTap: a.$4,
          ),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      elevation: 0,
      shadowColor: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppColors.ink.withValues(alpha: 0.05),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontWeight: FontWeight.w800,
                          fontSize: 13.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.onSeeAll});

  final String title;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        TextButton(
          onPressed: onSeeAll,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            textStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Lihat semua'),
              SizedBox(width: 2),
              Icon(Icons.chevron_right_rounded, size: 18),
            ],
          ),
        ),
      ],
    );
  }
}

class _UpcomingList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(upcomingMeetingsProvider);
    return async.when(
      loading: () => const GmListSkeleton(itemCount: 2),
      error: (e, _) => AppErrorView(
        message: 'Gagal memuat meeting.',
        onRetry: () => ref.read(upcomingMeetingsProvider.notifier).refresh(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return AppEmptyState(
            title: 'Belum ada jadwal',
            message: 'Buat meeting baru atau jadwalkan untuk tim Anda.',
            actionLabel: 'Meeting Baru',
            onAction: () => context.push(AppRoutes.createMeeting),
          );
        }
        return Column(
          children: [
            for (final item in items.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _UpcomingMeetingCard(meeting: item),
              ),
          ],
        );
      },
    );
  }
}

class _UpcomingMeetingCard extends StatelessWidget {
  const _UpcomingMeetingCard({required this.meeting});

  final MeetingSummary meeting;

  @override
  Widget build(BuildContext context) {
    final when = meeting.startsAt?.toLocal();
    final month = when != null ? _enMonth(when.month) : '—';
    final day = when != null ? when.day.toString().padLeft(2, '0') : '—';
    final dateLine = when != null
        ? _idLongDate(when)
        : meeting.roomName;
    final timeLine = when != null
        ? _timeRange(when, meeting.endsAt?.toLocal())
        : null;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(AppRoutes.meetingDetailPath(meeting.id)),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppColors.ink.withValues(alpha: 0.05),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            children: [
              if (meeting.status == MeetingStatus.active)
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            month,
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                              letterSpacing: 0.4,
                            ),
                          ),
                          Text(
                            day,
                            style: const TextStyle(
                              color: AppColors.navy,
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                              height: 1.1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            meeting.title,
                            style: const TextStyle(
                              color: AppColors.navy,
                              fontWeight: FontWeight.w800,
                              fontSize: 14.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            dateLine,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                          if (timeLine != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              timeLine,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              GmAvatar(
                                name: meeting.hostName ?? 'Host',
                                size: 20,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Host: ${meeting.hostName ?? '—'}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 11.5,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      children: [
                        const SizedBox(height: 4),
                        FilledButton(
                          onPressed: () => context.push(
                            AppRoutes.prejoinPath(
                              roomName: meeting.roomName,
                              meetingId: meeting.id,
                              meetingTitle: meeting.title,
                            ),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primarySoft,
                            foregroundColor: AppColors.primary,
                            elevation: 0,
                            minimumSize: const Size(64, 34),
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            textStyle: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                          child: const Text('Join'),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: () => context.push(
                            AppRoutes.meetingDetailPath(meeting.id),
                          ),
                          icon: const Icon(
                            Icons.more_vert_rounded,
                            color: AppColors.muted,
                            size: 20,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _idLongDate(DateTime d) {
    const days = [
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
      'Minggu',
    ];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    return '${days[d.weekday - 1]}, ${d.day} ${months[d.month - 1]} ${d.year}';
  }

  static String _timeRange(DateTime start, DateTime? end) {
    final a = DateFormat('HH.mm').format(start);
    if (end == null) return a;
    final b = DateFormat('HH.mm').format(end);
    return '$a - $b';
  }

  static String _enMonth(int m) {
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    return months[m - 1];
  }
}

class _RecentList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(previousMeetingsProvider);
    return async.when(
      loading: () => const GmListSkeleton(itemCount: 2),
      error: (e, _) => const SizedBox.shrink(),
      data: (items) {
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Belum ada riwayat meeting.',
              style: TextStyle(color: tokens.textSecondary, fontSize: 13),
            ),
          );
        }
        return Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppColors.ink.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              children: [
                for (var i = 0; i < items.take(3).length; i++) ...[
                  if (i > 0)
                    const Divider(height: 1, indent: 56, endIndent: 12),
                  _RecentRow(meeting: items[i]),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.meeting});

  final MeetingSummary meeting;

  @override
  Widget build(BuildContext context) {
    final when = meeting.startsAt?.toLocal() ?? meeting.createdAt?.toLocal();
    final meta = when != null
        ? '${_shortDay(when)}, ${when.day} ${_idMonth(when.month)} ${when.year} • ${DateFormat('HH.mm').format(when)}'
        : meeting.roomName;
    final duration = _durationLabel(meeting);

    return InkWell(
      onTap: () => context.push(AppRoutes.meetingDetailPath(meeting.id)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.videocam_rounded,
                color: AppColors.primary,
                size: 18,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    meeting.title,
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    meta,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
            if (duration != null) ...[
              Text(
                duration,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8),
            ],
            Icon(Icons.person_outline, size: 14, color: AppColors.muted),
            const SizedBox(width: 2),
            Text(
              '${meeting.participantCount}',
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: () =>
                  context.push(AppRoutes.meetingDetailPath(meeting.id)),
              icon: const Icon(
                Icons.more_vert_rounded,
                color: AppColors.muted,
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String? _durationLabel(MeetingSummary m) {
    final start = m.startsAt;
    final end = m.endsAt;
    if (start == null || end == null) return null;
    final mins = end.difference(start).inMinutes;
    if (mins <= 0) return null;
    return '$mins menit';
  }

  static String _shortDay(DateTime d) {
    const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    return days[d.weekday - 1];
  }

  static String _idMonth(int m) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    return months[m - 1];
  }
}

class _QuickContactsRow extends ConsumerWidget {
  const _QuickContactsRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(quickContactsProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 20),
        child: GmSkeleton(height: 88),
      ),
      error: (error, stackTrace) => const SizedBox.shrink(),
      data: (contacts) {
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          scrollDirection: Axis.horizontal,
          itemCount: contacts.length + 1,
          separatorBuilder: (context, index) => const SizedBox(width: 14),
          itemBuilder: (context, index) {
            if (index == contacts.length) {
              return GestureDetector(
                onTap: () => context.go(AppRoutes.contacts),
                child: SizedBox(
                  width: 72,
                  child: Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          shape: BoxShape.circle,
                          border: Border.all(color: tokens.divider),
                        ),
                        child: const Icon(
                          Icons.groups_outlined,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Semua Kontak',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.navy,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              );
            }
            final c = contacts[index];
            return SizedBox(
              width: 72,
              child: Column(
                children: [
                  Stack(
                    children: [
                      GmAvatar(name: c.name, size: 56),
                      if (c.isOnline)
                        Positioned(
                          right: 2,
                          bottom: 2,
                          child: Container(
                            width: 13,
                            height: 13,
                            decoration: BoxDecoration(
                              color: const Color(0xFF22C55E),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    c.name.split(' ').first,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.navy,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _PremiumBanner extends StatelessWidget {
  const _PremiumBanner({required this.plan, required this.onTap});

  final SubscriptionInfo? plan;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isFree = plan == null || plan!.plan == PlanCode.free;
    if (!isFree) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Ink(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: const LinearGradient(
                colors: [Color(0xFF2D8CFF), Color(0xFF0B5CFF)],
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.diamond_outlined, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Paket ${plan!.planLabel} aktif',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.white),
              ],
            ),
          ),
        ),
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [Color(0xFF2D8CFF), Color(0xFF0B5CFF)],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.28),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.diamond_outlined,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tingkatkan pengalaman rapat Anda',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Upgrade ke Premium untuk fitur tanpa batas',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'Upgrade ke Premium >',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

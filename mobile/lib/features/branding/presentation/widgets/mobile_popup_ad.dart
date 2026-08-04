import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:genmeet/app/config/providers.dart';
import 'package:genmeet/features/branding/application/branding_providers.dart';
import 'package:url_launcher/url_launcher.dart';

/// Full-bleed image popup for cold start (no card/frame chrome).
Future<void> maybeShowMobilePopupAd(BuildContext context, WidgetRef ref) async {
  if (ref.read(popupAdShownThisSessionProvider)) return;

  final branding = await ref.read(platformBrandingProvider.future);
  final popup = branding.mobilePopupAd;
  if (!popup.canShow || popup.imageUrl == null) return;
  if (!context.mounted) return;

  // Mark before show so concurrent shell/home mounts cannot double-open.
  ref.read(popupAdShownThisSessionProvider.notifier).state = true;

  final imageUrl = resolveBrandAssetUrl(
    ref.read(appConfigProvider).apiBaseUrl,
    popup.imageUrl!,
  );
  final linkUrl = popup.linkUrl;

  await showGeneralDialog<void>(
    context: context,
    useRootNavigator: true,
    barrierDismissible: true,
    barrierLabel: 'Tutup popup',
    barrierColor: Colors.black.withValues(alpha: 0.72),
    transitionDuration: const Duration(milliseconds: 180),
    pageBuilder: (dialogContext, animation, secondaryAnimation) {
      return SafeArea(
        child: Material(
          type: MaterialType.transparency,
          child: Stack(
            fit: StackFit.expand,
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => Navigator.of(dialogContext, rootNavigator: true).pop(),
                child: const SizedBox.expand(),
              ),
              Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(dialogContext).width * 0.92,
                    maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.82,
                  ),
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      GestureDetector(
                        onTap: () async {
                          final raw = linkUrl?.trim();
                          if (raw == null || raw.isEmpty) return;
                          final uri = Uri.tryParse(raw);
                          if (uri == null) return;
                          await launchUrl(
                            uri,
                            mode: LaunchMode.externalApplication,
                          );
                        },
                        child: CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.contain,
                          fadeInDuration: Duration.zero,
                          fadeOutDuration: Duration.zero,
                          placeholder: (_, __) => const SizedBox(
                            width: 120,
                            height: 120,
                            child: Center(
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                          errorWidget: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                      Positioned(
                        top: -6,
                        right: -6,
                        child: IconButton.filled(
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.black87,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.all(8),
                            minimumSize: const Size(36, 36),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          onPressed: () =>
                              Navigator.of(dialogContext, rootNavigator: true)
                                  .pop(),
                          icon: const Icon(Icons.close, size: 18),
                          tooltip: 'Tutup',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

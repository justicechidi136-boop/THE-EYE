import "package:flutter/material.dart";

import "../tokens.dart";
import "../typography.dart";

class EyeHeroSlide {
  const EyeHeroSlide({
    required this.title,
    required this.subtitle,
    required this.gradient,
    this.icon,
  });

  final String title;
  final String subtitle;
  final List<Color> gradient;
  final IconData? icon;
}

class EyeHeroCarousel extends StatefulWidget {
  const EyeHeroCarousel({required this.slides, super.key});

  final List<EyeHeroSlide> slides;

  @override
  State<EyeHeroCarousel> createState() => _EyeHeroCarouselState();
}

class _EyeHeroCarouselState extends State<EyeHeroCarousel> {
  late final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: EyeTokens.heroHeight,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.slides.length,
            onPageChanged: (value) => setState(() => _index = value),
            itemBuilder: (context, index) {
              final slide = widget.slides[index];
              return Stack(
                fit: StackFit.expand,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: slide.gradient,
                      ),
                    ),
                  ),
                  if (slide.icon != null)
                    Align(
                      alignment: const Alignment(0, -0.2),
                      child: Icon(
                        slide.icon,
                        size: 96,
                        color: Colors.white.withValues(alpha: 0.18),
                      ),
                    ),
                  Container(color: EyeTokens.heroOverlay),
                  Positioned(
                    left: 32,
                    right: 32,
                    bottom: 36,
                    child: Column(
                      children: [
                        Text(
                          slide.title,
                          textAlign: TextAlign.center,
                          style: EyeTypography.heroTitle,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          slide.subtitle,
                          textAlign: TextAlign.center,
                          style: EyeTypography.heroSubtitle,
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.slides.length, (index) {
            final active = index == _index;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: active ? 18 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: active ? EyeTokens.greenMain : EyeTokens.stroke,
                borderRadius: BorderRadius.circular(8),
              ),
            );
          }),
        ),
      ],
    );
  }
}

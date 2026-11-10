import torch
from torch import nn


class AASISTLite(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.feature_extractor = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.LeakyReLU(negative_slope=0.1, inplace=True),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.LeakyReLU(negative_slope=0.1, inplace=True),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.LeakyReLU(negative_slope=0.1, inplace=True),
            nn.AdaptiveAvgPool2d((1, 1)),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64, 32),
            nn.LeakyReLU(negative_slope=0.1, inplace=True),
            nn.Dropout(p=0.3),
            nn.Linear(32, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.ndim != 4:
            raise ValueError(
                "Expected input shape (batch_size, channels, n_mels, time_steps)"
            )
        if x.shape[1] != 1:
            raise ValueError("AASISTLite expects a single input channel")

        features = self.feature_extractor(x)
        logits = self.classifier(features)
        return torch.sigmoid(logits)

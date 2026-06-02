```yaml
name: Extend plan with prerequisites - how to configure CLI for {{platform_name + extra tooling}}
description: This plan extends the previous plan by adding prerequisites for configuring the CLI for a specific platform and extra tooling.
license: CC BY-NC-ND 4.0
metadata:
  tags:
    - cli
    - configuration
    - prerequisites
    - platform
    - tooling
```

Rozszerz plan o wymagania wstępne — jak skonfigurować CLI dla {{platform_name + extra tooling}}

Ten plan rozszerza poprzedni plan, dodając wymagania wstępne dotyczące konfiguracji CLI dla określonej platformy i dodatkowych narzędzi.

## Plan

1.  **Zrozumienie wymagań wstępnych:**
    *   Zidentyfikuj wszelkie zależności systemowe (np. Python, Node.js, Java) wymagane przez CLI lub dodatkowe narzędzia.
    *   Sprawdź, czy istnieją konkretne wersje tych zależności, które są wymagane.
    *   Określ, czy wymagane są jakieś zmienne środowiskowe lub ścieżki.

2.  **Instalacja zależności systemowych:**
    *   Podaj instrukcje dotyczące instalacji wymaganych zależności systemowych dla różnych systemów operacyjnych (np. `apt`, `yum`, `brew`, instalatory Windows).
    *   Upewnij się, że użytkownik weryfikuje poprawną instalację i wersję.

3.  **Konfiguracja zmiennych środowiskowych (jeśli dotyczy):**
    *   Wyjaśnij, jak ustawić wszelkie niezbędne zmienne środowiskowe (np. `PATH`, `JAVA_HOME`).
    *   Podaj przykłady dla różnych powłok (Bash, Zsh, PowerShell, CMD).

4.  **Instalacja CLI:**
    *   Podaj szczegółowe instrukcje dotyczące instalacji CLI dla {{platform_name}}.
    *   Uwzględnij różne metody instalacji (np. menedżer pakietów, skrypt instalacyjny, pobieranie binarne).
    *   Weryfikacja instalacji CLI (np. `{{platform_name}} --version`).

5.  **Instalacja dodatkowych narzędzi:**
    *   Podaj instrukcje dotyczące instalacji {{extra tooling}}.
    *   Uwzględnij wszelkie specyficzne kroki konfiguracji wymagane dla {{extra tooling}}.
    *   Weryfikacja instalacji {{extra tooling}}.

6.  **Konfiguracja CLI dla {{platform_name}}:**
    *   Wyjaśnij, jak zainicjować lub skonfigurować CLI (np. `{{platform_name}} configure`, `{{platform_name}} login`).
    *   Podaj instrukcje dotyczące uwierzytelniania (np. klucze API, tokeny, dane logowania).
    *   Omów wszelkie specyficzne dla platformy ustawienia konfiguracji (np. region, projekt, profil).

7.  **Testowanie konfiguracji:**
    *   Podaj proste polecenia testowe, aby upewnić się, że CLI i dodatkowe narzędzia działają poprawnie i są prawidłowo skonfigurowane.
    *   Przykłady: `{{platform_name}} list-resources`, `{{extra tooling}} status`.

## Przykład: Konfiguracja AWS CLI i Terraform

### 1. Zrozumienie wymagań wstępnych

*   **AWS CLI:** Wymaga Pythona 3.x.
*   **Terraform:** Nie wymaga żadnych zależności systemowych poza samym plikiem binarnym Terraform.

### 2. Instalacja zależności systemowych

#### Python 3 (dla AWS CLI)

**macOS (za pomocą Homebrew):**

```bash
brew install python
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install python3 python3-pip
```

**Windows (za pomocą instalatora):**

Pobierz instalator z [python.org](https://www.python.org/downloads/windows/) i postępuj zgodnie z instrukcjami. Upewnij się, że zaznaczyłeś opcję "Add Python to PATH".

**Weryfikacja:**

```bash
python3 --version
pip3 --version
```

### 3. Konfiguracja zmiennych środowiskowych (nie dotyczy w tym przykładzie, ponieważ Python jest dodawany do PATH)

### 4. Instalacja CLI

#### AWS CLI

**macOS/Linux (za pomocą `pip`):**

```bash
pip3 install awscli --upgrade --user
```

**Windows (za pomocą instalatora MSI):**

Pobierz instalator MSI z [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) i postępuj zgodnie z instrukcjami.

**Weryfikacja:**

```bash
aws --version
```

### 5. Instalacja dodatkowych narzędzi

#### Terraform

**macOS (za pomocą Homebrew):**

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

**Ubuntu/Debian:**

```bash
sudo apt update && sudo apt install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | \
    gpg --dearmor | \
    sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
gpg --no-default-keyring \
    --keyring /usr/share/keyrings/hashicorp-archive-keyring.gpg \
    --fingerprint
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
    https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
    sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update
sudo apt install terraform
```

**Windows (ręczna instalacja):**

1.  Pobierz odpowiedni plik binarny Terraform z [terraform.io/downloads](https://www.terraform.io/downloads).
2.  Rozpakuj plik ZIP.
3.  Przenieś plik `terraform.exe` do katalogu w zmiennej środowiskowej `PATH` (np. `C:\Program Files\Terraform`).

**Weryfikacja:**

```bash
terraform --version
```

### 6. Konfiguracja CLI dla AWS

#### Konfiguracja AWS CLI

```bash
aws configure
```

Zostaniesz poproszony o podanie:

*   `AWS Access Key ID`: Twój klucz dostępu AWS.
*   `AWS Secret Access Key`: Twój tajny klucz dostępu AWS.
*   `Default region name`: Domyślny region AWS (np. `us-east-1`).
*   `Default output format`: Domyślny format wyjściowy (np. `json`).

### 7. Testowanie konfiguracji

#### Testowanie AWS CLI

```bash
aws s3 ls
```

To polecenie powinno wyświetlić listę twoich zasobników S3.

#### Testowanie Terraform

Utwórz plik `main.tf`:

```terraform
provider "aws" {
  region = "us-east-1" # Użyj swojego domyślnego regionu
}

resource "aws_s3_bucket" "example" {
  bucket = "my-unique-terraform-test-bucket-12345" # Zmień na unikalną nazwę
  acl    = "private"

  tags = {
    Name        = "My Terraform Test Bucket"
    Environment = "Dev"
  }
}
```

Następnie uruchom:

```bash
terraform init
terraform plan
```

`terraform plan` powinien pokazać, że Terraform zamierza utworzyć zasobnik S3. Nie musisz go stosować, aby zweryfikować konfigurację.